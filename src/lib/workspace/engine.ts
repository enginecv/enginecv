import { mapFileError, type FileAdapter, type FileStamp } from "@/lib/linked-file/fs-access";
import { hashText } from "@/lib/linked-file/hash";
import type { LinkDivergence, LinkedFileState } from "@/lib/linked-file/types";
import type { DocumentCodec } from "./codecs/types";
import type { ReasonCode } from "./types";

/**
 * The sync state machine for one document file: poll the file, validate what an outside program
 * wrote, apply it to the document as one revertible update, and write app changes back.
 * Transport-agnostic (it only sees a `FileAdapter`) and document-agnostic (a `DocumentCodec`
 * says how a CV or a letter is parsed, applied and written), so the same algorithm serves the
 * per-CV link and every document of a workspace folder.
 */

export const POLL_MS = 1500;
export const IDLE_POLL_MS = 2000;
const IDLE_AFTER_MS = 60_000;
export const WRITE_DEBOUNCE_MS = 800;
export const STABILITY_MS = 400;
export const BUSY_BACKOFF_MS = [1000, 2000, 4000, 8000] as const;

export type StartMode = "adopt" | "load" | "reconcile" | "paused";

/** The state an engine reports: `LinkedFileState` with a reason code that can name any refusal. */
export interface EngineState extends Omit<LinkedFileState, "error"> {
    error: { code: ReasonCode; line?: number; column?: number } | null;
}

export interface DocumentEngineDeps<TDoc> {
    adapter: FileAdapter;
    codec: DocumentCodec<TDoc>;
    getDoc: () => TDoc;
    /** Applies a content transform to the document (one store update). */
    applyIncoming: (transform: (doc: TDoc) => TDoc) => void;
    /** Saves the document as it is now, before a file update replaces content. */
    snapshot: (doc: TDoc) => Promise<unknown>;
    /** Makes sure typed content is saved before the file update lands. */
    flushLocal?: () => Promise<void>;
    /** The privacy option: leave contact fields out of written text. */
    hideContact?: () => boolean;
    onState: (patch: Partial<EngineState>) => void;
    /** Tells the host the person paused or resumed (it persists the choice). */
    onPausedChange?: (paused: boolean) => void;
    /** Fires after the adapter's file name may have changed (relink, rename). */
    onFileName?: (name: string) => void;
    now?: () => number;
    isVisible?: () => boolean;
}

export interface DocumentSyncEngine {
    start(mode?: StartMode): Promise<void>;
    stop(): void;
    /** One read cycle now (poll tick, "Check now", tab became visible). */
    checkNow(): Promise<void>;
    /** The document changed in the app. */
    notifyLocalChange(): void;
    /** Writes pending editor changes now. */
    flushWrite(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    resolveDivergence(winner: "file" | "cv"): Promise<void>;
    onVisibilityChange(): void;
    onFocus(): void;
    /** The text last written or applied; for tests and the link flow. */
    readonly lastSyncedHash: string | null;
}

const sameStamp = (a: FileStamp | null, b: FileStamp | null) =>
    a !== null && b !== null && a.lastModified === b.lastModified && a.size === b.size;

type ReadOutcome =
    | { kind: "applied" | "unchanged" }
    | { kind: "error"; code: ReasonCode; line?: number; column?: number };

export function createDocumentSyncEngine<TDoc>(deps: DocumentEngineDeps<TDoc>): DocumentSyncEngine {
    const { codec } = deps;
    const serializeOptions = () => ({ hideContact: deps.hideContact?.() ?? false });
    const canonicalText = (doc: TDoc) => codec.serialize(doc, serializeOptions());
    const canonicalHash = (doc: TDoc) => hashText(canonicalText(doc));
    const now = deps.now ?? (() => Date.now());
    const visible = deps.isVisible ?? (() => typeof document === "undefined" || document.visibilityState === "visible");

    let running = false;
    let paused = false;
    let status: EngineState["status"] = "none";
    let lastStamp: FileStamp | null = null;
    let lastSyncedHash: string | null = null;
    let queue: Promise<unknown> = Promise.resolve();
    let inFlight = 0;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let writeTimer: ReturnType<typeof setTimeout> | null = null;
    let busyTimer: ReturnType<typeof setTimeout> | null = null;
    let busyAttempt = 0;
    let idleSince = now();
    let pausedBaseline: { fileHash: string | null; cvHash: string } | null = null;
    let divergence: LinkDivergence | null = null;
    let pendingWrite = false;

    const emit = (patch: Partial<EngineState>) => {
        if (patch.status) status = patch.status;
        deps.onState(patch);
    };

    const enqueue = <T,>(task: () => Promise<T>): Promise<T> => {
        inFlight += 1;
        const run = queue.then(task, task);
        queue = run.then(
            () => undefined,
            () => undefined,
        ).finally(() => {
            inFlight -= 1;
        });
        return run;
    };

    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    // -- state helpers ---------------------------------------------------------

    const settleInSync = () => {
        busyAttempt = 0;
        emit({ status: "in-sync", error: null, lastSyncedAt: now(), fileName: deps.adapter.name });
    };

    const goBroken = () => {
        clearTimers();
        emit({ status: "broken", error: null });
    };

    const handleFileError = (error: unknown, retry: () => void) => {
        const mapped = mapFileError(error);
        if (mapped.code === "not-found" || mapped.code === "permission") {
            goBroken();
            return;
        }
        if (mapped.code === "busy") {
            emit({ status: "busy" });
            if (busyAttempt < BUSY_BACKOFF_MS.length) {
                const delay = BUSY_BACKOFF_MS[busyAttempt];
                busyAttempt += 1;
                if (busyTimer) clearTimeout(busyTimer);
                busyTimer = setTimeout(() => {
                    busyTimer = null;
                    retry();
                }, delay);
            }
            // After the last delay the next file change or editor change tries again.
            return;
        }
        emit({ status: "broken", error: null });
        clearTimers();
    };

    function clearTimers() {
        if (pollTimer) clearTimeout(pollTimer);
        if (writeTimer) clearTimeout(writeTimer);
        if (busyTimer) clearTimeout(busyTimer);
        pollTimer = writeTimer = busyTimer = null;
    }

    // -- reading -----------------------------------------------------------------

    /** Validates `text`; a valid document is applied as one revertible update. */
    async function processText(text: string, options: { force?: boolean } = {}): Promise<ReadOutcome> {
        const parsed = codec.parse(text, { now: now(), hideContact: deps.hideContact?.() ?? false });
        if (!parsed.ok) return { kind: "error", code: parsed.reason.code, line: parsed.reason.line, column: parsed.reason.column };

        const hash = hashText(text);
        if (!options.force && hash === lastSyncedHash) return { kind: "unchanged" };

        await deps.flushLocal?.();
        const before = deps.getDoc();
        const allowed = codec.canApplyExternal(before);
        if (!allowed.ok) return { kind: "error", code: allowed.reason.code, line: allowed.reason.line, column: allowed.reason.column };

        const next = codec.apply(before, parsed.doc, serializeOptions());
        const change = codec.describeChange(before, next);
        const identical = codec.isSameContent(before, next);

        lastSyncedHash = hash;
        if (identical) return { kind: "unchanged" };

        await deps.snapshot(before);
        deps.applyIncoming((current) => codec.apply(current, parsed.doc, serializeOptions()));
        idleSince = now();
        const meaningful = change.added + change.removed + change.changed > 0 || parsed.notices.length > 0;
        emit({
            lastUpdate: meaningful
                ? { at: now(), ...change, notices: parsed.notices }
                : null,
        });
        return { kind: "applied" };
    }

    function reportRead(outcome: ReadOutcome) {
        if (outcome.kind === "error") {
            emit({ status: "error", error: { code: outcome.code, line: outcome.line, column: outcome.column } });
        } else {
            settleInSync();
        }
    }

    /** One read cycle. Returns after the file was inspected (and applied when it changed). */
    async function readCycle(options: { force?: boolean } = {}): Promise<void> {
        if (!running || paused) return;
        try {
            const first = await deps.adapter.stat();
            if (!options.force && sameStamp(first, lastStamp)) return;
            // A program that is still writing changes the stamp again; wait for it to settle.
            if (!options.force) {
                await sleep(STABILITY_MS);
                const second = await deps.adapter.stat();
                if (!sameStamp(first, second)) {
                    idleSince = now();
                    return;
                }
            }
            const text = await deps.adapter.readText();
            lastStamp = first;
            idleSince = now();
            const outcome = await processText(text, options);
            reportRead(outcome);
            deps.onFileName?.(deps.adapter.name);
            if (outcome.kind === "unchanged" && status === "in-sync") emit({ fileName: deps.adapter.name });
            if (pendingWrite) scheduleWrite();
        } catch (error) {
            handleFileError(error, () => void checkNow());
        }
    }

    function checkNow(): Promise<void> {
        return enqueue(() => readCycle());
    }

    // -- writing -----------------------------------------------------------------

    function scheduleWrite() {
        if (!running || paused || status === "error" || status === "broken") {
            pendingWrite = false;
            return;
        }
        pendingWrite = true;
        if (writeTimer) clearTimeout(writeTimer);
        writeTimer = setTimeout(() => {
            writeTimer = null;
            void flushWrite();
        }, WRITE_DEBOUNCE_MS);
    }

    async function writeCycle(options: { force?: boolean } = {}): Promise<void> {
        if (!running || paused) return;
        if (!options.force && (status === "error" || status === "broken")) return;
        pendingWrite = false;
        try {
            const text = canonicalText(deps.getDoc());
            const hash = hashText(text);
            if (!options.force && hash === lastSyncedHash) return;

            // The file may have moved on while the write waited: read first, never overwrite blindly.
            if (!options.force) {
                const stamp = await deps.adapter.stat();
                if (!sameStamp(stamp, lastStamp)) {
                    const current = await deps.adapter.readText();
                    if (hashText(current) !== lastSyncedHash) {
                        lastStamp = stamp;
                        const outcome = await processText(current);
                        reportRead(outcome);
                        return;
                    }
                    lastStamp = stamp;
                }
            }

            await deps.adapter.writeText(text);
            lastStamp = await deps.adapter.stat();
            lastSyncedHash = hash;
            idleSince = now();
            settleInSync();
        } catch (error) {
            pendingWrite = true;
            handleFileError(error, () => scheduleWrite());
        }
    }

    function flushWrite(): Promise<void> {
        if (writeTimer) {
            clearTimeout(writeTimer);
            writeTimer = null;
        }
        return enqueue(() => writeCycle());
    }

    // -- polling -----------------------------------------------------------------

    function pollInterval() {
        return now() - idleSince > IDLE_AFTER_MS ? IDLE_POLL_MS : POLL_MS;
    }

    function schedulePoll() {
        if (pollTimer) clearTimeout(pollTimer);
        pollTimer = null;
        if (!running || paused || status === "broken" || !visible()) return;
        pollTimer = setTimeout(() => {
            pollTimer = null;
            // Skip this tick while a read or write is still in flight.
            const run = inFlight > 0 ? Promise.resolve() : checkNow();
            void run.finally(schedulePoll);
        }, pollInterval());
    }

    // -- public API --------------------------------------------------------------

    async function start(mode: StartMode = "adopt") {
        running = true;
        paused = false;
        divergence = null;
        emit({ fileName: deps.adapter.name, error: null, divergence: null });
        await enqueue(async () => {
            try {
                const stamp = await deps.adapter.stat();
                const text = await deps.adapter.readText();
                lastStamp = stamp;
                const fileHash = hashText(text);
                const cv = deps.getDoc();
                const cvHash = canonicalHash(cv);

                if (mode === "paused") {
                    paused = true;
                    lastSyncedHash = fileHash;
                    pausedBaseline = { fileHash, cvHash };
                    emit({ status: "paused" });
                    return;
                }
                if (mode === "adopt" || fileHash === cvHash) {
                    lastSyncedHash = fileHash;
                    settleInSync();
                    return;
                }
                if (mode === "load" || stamp.lastModified > codec.updatedAt(cv)) {
                    lastSyncedHash = null;
                    reportRead(await processText(text, { force: true }));
                    return;
                }
                // The CV is the newer side: never overwrite the file without asking.
                paused = true;
                lastSyncedHash = fileHash;
                divergence = { fileChanged: false, cvChanged: true };
                pausedBaseline = { fileHash, cvHash: "" };
                emit({ status: "paused", divergence });
            } catch (error) {
                handleFileError(error, () => void start(mode));
            }
        });
        schedulePoll();
    }

    function stop() {
        running = false;
        clearTimers();
    }

    async function pause() {
        if (!running || paused) return;
        if (writeTimer) await flushWrite();
        await enqueue(async () => {
            paused = true;
            pausedBaseline = { fileHash: lastSyncedHash, cvHash: canonicalHash(deps.getDoc()) };
            clearTimers();
            emit({ status: "paused", divergence: null });
        });
        deps.onPausedChange?.(true);
    }

    async function resume() {
        if (!running || !paused) return;
        await enqueue(async () => {
            try {
                const text = await deps.adapter.readText();
                const fileHash = hashText(text);
                const cvHash = canonicalHash(deps.getDoc());
                const fileChanged = fileHash !== (pausedBaseline?.fileHash ?? fileHash);
                const cvChanged = cvHash !== (pausedBaseline?.cvHash ?? cvHash);
                if (!fileChanged && !cvChanged) {
                    paused = false;
                    lastStamp = await deps.adapter.stat();
                    lastSyncedHash = fileHash;
                    divergence = null;
                    settleInSync();
                    deps.onPausedChange?.(false);
                    return;
                }
                divergence = { fileChanged, cvChanged };
                emit({ status: "paused", divergence });
            } catch (error) {
                handleFileError(error, () => undefined);
            }
        });
        if (!paused) schedulePoll();
    }

    async function resolveDivergence(winner: "file" | "cv") {
        if (!running || !paused) return;
        await enqueue(async () => {
            try {
                paused = false;
                divergence = null;
                emit({ divergence: null });
                if (winner === "file") {
                    const text = await deps.adapter.readText();
                    lastStamp = await deps.adapter.stat();
                    lastSyncedHash = null;
                    reportRead(await processText(text, { force: true }));
                } else {
                    await writeCycle({ force: true });
                }
                deps.onPausedChange?.(false);
            } catch (error) {
                paused = true;
                handleFileError(error, () => undefined);
            }
        });
        schedulePoll();
    }

    function onVisibilityChange() {
        if (!running) return;
        if (!visible()) {
            if (pollTimer) clearTimeout(pollTimer);
            pollTimer = null;
            return;
        }
        idleSince = now();
        void checkNow().finally(schedulePoll);
    }

    function onFocus() {
        if (!running) return;
        idleSince = now();
        schedulePoll();
    }

    return {
        start,
        stop,
        checkNow,
        notifyLocalChange() {
            if (!running) return;
            idleSince = now();
            // A new editor change earns a fresh round of retries after a busy file.
            busyAttempt = 0;
            scheduleWrite();
        },
        flushWrite,
        pause,
        resume,
        resolveDivergence,
        onVisibilityChange,
        onFocus,
        get lastSyncedHash() {
            return lastSyncedHash;
        },
    };
}


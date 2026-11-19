/**
 * An in-memory stand-in for the browser's directory and file handles, with the behaviours measured
 * in specs/091-agent-workspace/spikes.md so tests can lean on them:
 *
 * - a reader sees the old content until a writable is closed (the swap), and `<name>.crswap` is listed
 *   while a write is open;
 * - two open writables: the last one closed wins;
 * - `move()` onto an existing name replaces it without an error;
 * - a handle to a deleted file throws `NotFoundError`;
 * - `lastModified` advances on every close, and the clock is injectable;
 * - optional Windows-style behaviour: case-insensitive names and refused reserved names;
 * - injectable failures (busy file, permission) and an optional change observer.
 *
 * Only the subset the workspace code uses is implemented.
 */

type Kind = "file" | "directory";

export interface MemoryOptions {
    /** Windows and macOS disks fold case; OPFS does not. */
    caseInsensitive?: boolean;
    /** Windows refuses `con`, `aux`, trailing dots and so on. */
    refuseReservedNames?: boolean;
    now?: () => number;
}

export type MemoryPermission = "granted" | "prompt" | "denied";

export type MemoryChange = { type: "appeared" | "modified" | "disappeared"; path: string[] };

interface Shared {
    options: Required<Omit<MemoryOptions, "now">> & { now: () => number };
    clock: { last: number };
    permission: MemoryPermission;
    requestOutcome: MemoryPermission;
    failures: Map<string, { error: string; remaining: number }>;
    observers: Set<(changes: MemoryChange[]) => void>;
}

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

function domError(name: string, message = name): DOMException {
    return new DOMException(message, name);
}

function fold(shared: Shared, name: string): string {
    return shared.options.caseInsensitive ? name.toLowerCase() : name;
}

function assertName(shared: Shared, name: string) {
    if (name === "" || name === "." || name === ".." || name.includes("/") || name.includes("\\")) throw new TypeError(`Invalid name: ${name}`);
    if (shared.options.refuseReservedNames && (RESERVED.test(name) || /[. ]$/.test(name))) throw domError("InvalidModificationError", `Reserved name: ${name}`);
}

function tick(shared: Shared): number {
    const wanted = shared.options.now();
    shared.clock.last = Math.max(shared.clock.last + 1, wanted);
    return shared.clock.last;
}

function notify(shared: Shared, changes: MemoryChange[]) {
    for (const observer of shared.observers) observer(changes);
}

class MemoryFileData {
    constructor(public bytes: string, public lastModified: number) {}
}

export class MemoryFileHandle {
    readonly kind: Kind = "file";
    constructor(
        private readonly shared: Shared,
        private readonly parent: MemoryDirectoryHandle,
        private data: MemoryFileData | null,
        public name: string,
        /** A listing-only handle (the swap file of a write in progress): readable, not part of the tree. */
        private readonly virtual = false,
    ) {}

    private alive(): MemoryFileData {
        if (this.virtual && this.data) return this.data;
        // The file is alive only while its parent still holds this very data object under this name.
        const current = this.parent._lookupFile(this.name);
        if (!this.data || !current || current !== this.data) throw domError("NotFoundError", "A requested file or directory could not be found at the time an operation was processed.");
        return this.data;
    }

    async getFile() {
        this.maybeFail("read");
        const data = this.alive();
        const name = this.name;
        return {
            name,
            size: data.bytes.length,
            lastModified: data.lastModified,
            text: async () => data.bytes,
        };
    }

    async createWritable() {
        this.maybeFail("write");
        const data = this.alive();
        let staged = "";
        let done = false;
        this.parent._swapOpen(this.name, +1);
        return {
            write: async (chunk: string | { text?: () => Promise<string> }) => {
                if (done) throw domError("InvalidStateError");
                staged += typeof chunk === "string" ? chunk : await (chunk as { text: () => Promise<string> }).text();
            },
            close: async () => {
                if (done) throw domError("InvalidStateError");
                done = true;
                this.parent._swapOpen(this.name, -1);
                this.maybeFail("close");
                // The last writable closed wins; it replaces the content under the same name.
                const target = this.parent._lookupFile(this.name) ?? data;
                target.bytes = staged;
                target.lastModified = tick(this.shared);
                notify(this.shared, [{ type: "modified", path: [...this.parent._path(), this.name] }]);
            },
            abort: async () => {
                if (done) return;
                done = true;
                this.parent._swapOpen(this.name, -1);
            },
        };
    }

    /** Renames in place. Onto an existing name it replaces that file silently (spike S1). */
    async move(newName: string) {
        const data = this.alive();
        assertName(this.shared, newName);
        this.parent._rename(this.name, newName, data);
        this.name = newName;
    }

    async isSameEntry(other: MemoryFileHandle) {
        return other.data === this.data;
    }

    /** @internal */
    private maybeFail(operation: string) {
        const key = `${fold(this.shared, this.name)}:${operation}`;
        const failure = this.shared.failures.get(key);
        if (failure && failure.remaining > 0) {
            failure.remaining -= 1;
            throw domError(failure.error);
        }
    }

    async queryPermission() {
        return this.shared.permission;
    }

    async requestPermission() {
        this.shared.permission = this.shared.requestOutcome;
        return this.shared.permission;
    }
}

export class MemoryDirectoryHandle {
    readonly kind: Kind = "directory";
    private files = new Map<string, { name: string; data: MemoryFileData }>();
    private dirs = new Map<string, { name: string; dir: MemoryDirectoryHandle }>();
    private openWrites = new Map<string, number>();

    constructor(private readonly shared: Shared, public name: string, private readonly parentDir: MemoryDirectoryHandle | null = null) {}

    // -- helpers used by file handles (underscore: not part of the browser API) -------------------

    _path(): string[] {
        return this.parentDir ? [...this.parentDir._path(), this.name] : [];
    }

    _lookupFile(name: string): MemoryFileData | undefined {
        return this.files.get(fold(this.shared, name))?.data;
    }

    _swapOpen(name: string, delta: number) {
        const key = fold(this.shared, name);
        this.openWrites.set(key, Math.max(0, (this.openWrites.get(key) ?? 0) + delta));
    }

    _rename(from: string, to: string, data: MemoryFileData) {
        const fromKey = fold(this.shared, from);
        this.files.delete(fromKey);
        this.files.set(fold(this.shared, to), { name: to, data });
        notify(this.shared, [
            { type: "disappeared", path: [...this._path(), from] },
            { type: "appeared", path: [...this._path(), to] },
        ]);
    }

    // -- browser API ------------------------------------------------------------------------------

    async getFileHandle(name: string, options: { create?: boolean } = {}): Promise<MemoryFileHandle> {
        assertName(this.shared, name);
        const key = fold(this.shared, name);
        const existing = this.files.get(key);
        if (existing) return new MemoryFileHandle(this.shared, this, existing.data, existing.name);
        if (this.dirs.has(key)) throw domError("TypeMismatchError");
        if (!options.create) throw domError("NotFoundError");
        const data = new MemoryFileData("", tick(this.shared));
        this.files.set(key, { name, data });
        notify(this.shared, [{ type: "appeared", path: [...this._path(), name] }]);
        return new MemoryFileHandle(this.shared, this, data, name);
    }

    async getDirectoryHandle(name: string, options: { create?: boolean } = {}): Promise<MemoryDirectoryHandle> {
        assertName(this.shared, name);
        const key = fold(this.shared, name);
        const existing = this.dirs.get(key);
        if (existing) return existing.dir;
        if (this.files.has(key)) throw domError("TypeMismatchError");
        if (!options.create) throw domError("NotFoundError");
        const dir = new MemoryDirectoryHandle(this.shared, name, this);
        this.dirs.set(key, { name, dir });
        notify(this.shared, [{ type: "appeared", path: [...this._path(), name] }]);
        return dir;
    }

    async removeEntry(name: string, options: { recursive?: boolean } = {}) {
        const key = fold(this.shared, name);
        if (this.files.delete(key)) {
            notify(this.shared, [{ type: "disappeared", path: [...this._path(), name] }]);
            return;
        }
        const dir = this.dirs.get(key);
        if (dir) {
            if (!options.recursive && (dir.dir.files.size > 0 || dir.dir.dirs.size > 0)) throw domError("InvalidModificationError");
            this.dirs.delete(key);
            notify(this.shared, [{ type: "disappeared", path: [...this._path(), name] }]);
            return;
        }
        throw domError("NotFoundError");
    }

    async *entries(): AsyncGenerator<[string, MemoryFileHandle | MemoryDirectoryHandle]> {
        for (const { name, data } of [...this.files.values()]) yield [name, new MemoryFileHandle(this.shared, this, data, name)];
        // A write in progress shows its swap file, as the browser does.
        for (const [key, count] of this.openWrites) {
            if (count > 0 && this.files.has(key)) {
                const name = `${this.files.get(key)!.name}.crswap`;
                yield [name, new MemoryFileHandle(this.shared, this, new MemoryFileData("", tick(this.shared)), name, true)];
            }
        }
        for (const { name, dir } of [...this.dirs.values()]) yield [name, dir];
    }

    async *keys() {
        for await (const [name] of this.entries()) yield name;
    }

    async *values() {
        for await (const [, handle] of this.entries()) yield handle;
    }

    [Symbol.asyncIterator]() {
        return this.entries();
    }

    async isSameEntry(other: MemoryDirectoryHandle) {
        return other === this;
    }

    async queryPermission() {
        return this.shared.permission;
    }

    async requestPermission() {
        this.shared.permission = this.shared.requestOutcome;
        return this.shared.permission;
    }
}

export interface MemoryDirectory {
    root: MemoryDirectoryHandle;
    /** Writes a file the way an outside program would (no swap file, lastModified advances). */
    writeExternal(path: string, text: string): Promise<void>;
    readExternal(path: string): Promise<string | null>;
    removeExternal(path: string): Promise<void>;
    listExternal(path?: string): Promise<string[]>;
    setPermission(state: MemoryPermission, requestOutcome?: MemoryPermission): void;
    /** Makes the next `times` operations on `file` fail with the named DOMException (for example `NoModificationAllowedError` for a busy file). */
    failNext(file: string, operation: "read" | "write" | "close", error: string, times?: number): void;
    clearFailures(): void;
    /** Subscribe to changes, the way a FileSystemObserver would report them. */
    observe(callback: (changes: MemoryChange[]) => void): () => void;
}

export function createMemoryDirectory(name = "workspace", options: MemoryOptions = {}): MemoryDirectory {
    const shared: Shared = {
        options: { caseInsensitive: options.caseInsensitive ?? false, refuseReservedNames: options.refuseReservedNames ?? false, now: options.now ?? (() => Date.now()) },
        clock: { last: 0 },
        permission: "granted",
        requestOutcome: "granted",
        failures: new Map(),
        observers: new Set(),
    };
    const root = new MemoryDirectoryHandle(shared, name);

    const split = (path: string) => path.split("/").filter(Boolean);
    const dirFor = async (parts: string[], create: boolean) => {
        let dir = root;
        for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
        return dir;
    };

    return {
        root,
        async writeExternal(path, text) {
            const parts = split(path);
            const fileName = parts.pop()!;
            const dir = await dirFor(parts, true);
            const handle = await dir.getFileHandle(fileName, { create: true });
            const data = (handle as unknown as { data: MemoryFileData }).data;
            data.bytes = text;
            data.lastModified = tick(shared);
            notify(shared, [{ type: "modified", path: [...parts, fileName] }]);
        },
        async readExternal(path) {
            const parts = split(path);
            const fileName = parts.pop()!;
            try {
                const dir = await dirFor(parts, false);
                return await (await (await dir.getFileHandle(fileName)).getFile()).text();
            } catch {
                return null;
            }
        },
        async removeExternal(path) {
            const parts = split(path);
            const fileName = parts.pop()!;
            const dir = await dirFor(parts, false);
            await dir.removeEntry(fileName, { recursive: true });
        },
        async listExternal(path = "") {
            const names: string[] = [];
            for await (const [entry] of (await dirFor(split(path), false)).entries()) names.push(entry);
            return names.sort();
        },
        setPermission(state, requestOutcome = "granted") {
            shared.permission = state;
            shared.requestOutcome = requestOutcome;
        },
        failNext(file, operation, error, times = 1) {
            shared.failures.set(`${fold(shared, file)}:${operation}`, { error, remaining: times });
        },
        clearFailures() {
            shared.failures.clear();
        },
        observe(callback) {
            shared.observers.add(callback);
            return () => shared.observers.delete(callback);
        },
    };
}

/**
 * Installs a `FileSystemObserver` global backed by a memory directory, so code that feature-detects
 * the observer can be tested. Returns a function that removes it.
 */
export function installMemoryObserver(directory: MemoryDirectory): () => void {
    class MemoryObserver {
        private stop: (() => void) | null = null;
        constructor(private readonly callback: (records: Array<{ type: string; relativePathComponents: string[] }>) => void) {}
        async observe(handle: MemoryDirectoryHandle) {
            const base = handle._path();
            this.stop = directory.observe((changes) => {
                const records = changes
                    .filter((change) => base.every((part, index) => change.path[index] === part))
                    .map((change) => ({ type: change.type, relativePathComponents: change.path.slice(base.length) }));
                if (records.length > 0) this.callback(records);
            });
        }
        disconnect() {
            this.stop?.();
            this.stop = null;
        }
    }
    const target = globalThis as unknown as { FileSystemObserver?: unknown };
    const previous = target.FileSystemObserver;
    target.FileSystemObserver = MemoryObserver;
    return () => {
        if (previous === undefined) delete target.FileSystemObserver;
        else target.FileSystemObserver = previous;
    };
}

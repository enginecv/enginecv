"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/db";
import type { Resume } from "@/lib/schema";
import { resolveLetter, type ResolvedLetter } from "./resolve";
import type { LetterDocument } from "./schema";
import { getLetter, loadCv, saveLetter } from "./store";

const AUTOSAVE_DELAY_MS = 600;

export type LetterLoadState = "loading" | "missing" | "ready";
export type LetterSaveState = "idle" | "saving" | "saved" | "error";

export interface UseLetter {
    loadState: LetterLoadState;
    /** The letter as the person is editing it. */
    letter: LetterDocument | null;
    /** The linked CV right now; null when it does not exist. */
    cv: Resume | null;
    cvLoading: boolean;
    resolved: ResolvedLetter | null;
    saveState: LetterSaveState;
    /** The copy another tab saved, when this tab's save would have overwritten it. */
    conflict: LetterDocument | null;
    update: (change: (current: LetterDocument) => LetterDocument) => void;
    keepMine: () => void;
    loadTheirs: () => void;
    /** Writes any pending edit now (used before leaving or exporting). */
    flush: () => Promise<void>;
}

/**
 * One open letter. The text lives in local state and is saved on a short debounce;
 * the linked CV is read through a live query, so a CV change only ever replaces the
 * derived `resolved` output and never the text being typed.
 */
export function useLetter(letterId: string): UseLetter {
    const [loadState, setLoadState] = useState<LetterLoadState>("loading");
    const [letter, setLetter] = useState<LetterDocument | null>(null);
    const [saveState, setSaveState] = useState<LetterSaveState>("idle");
    const [conflict, setConflict] = useState<LetterDocument | null>(null);

    const letterRef = useRef<LetterDocument | null>(null);
    const loadedUpdatedAt = useRef(0);
    const dirty = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saving = useRef<Promise<void> | null>(null);
    /** True from the moment a save starts until its result is known; the database's echo of it is not "another tab". */
    const inFlight = useRef(false);

    // First load.
    useEffect(() => {
        let cancelled = false;
        void getLetter(letterId).then((found) => {
            if (cancelled) return;
            if (!found) {
                setLoadState("missing");
                return;
            }
            letterRef.current = found;
            loadedUpdatedAt.current = found.updatedAt;
            setLetter(found);
            setLoadState("ready");
        });
        return () => {
            cancelled = true;
        };
    }, [letterId]);

    const save = useCallback(async () => {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
        const current = letterRef.current;
        if (!current || !dirty.current) return;
        dirty.current = false;
        inFlight.current = true;
        setSaveState("saving");
        try {
            const result = await saveLetter(current, loadedUpdatedAt.current);
            if (result.ok) {
                loadedUpdatedAt.current = result.letter.updatedAt;
                // Keep the person's text; take only what the data layer owns.
                if (letterRef.current) letterRef.current = { ...letterRef.current, updatedAt: result.letter.updatedAt, lastResolved: result.letter.lastResolved };
                setSaveState(dirty.current ? "saving" : "saved");
            } else {
                dirty.current = true;
                setConflict(result.conflict);
                setSaveState("error");
            }
        } catch {
            dirty.current = true;
            setSaveState("error");
        } finally {
            inFlight.current = false;
        }
    }, []);

    const flush = useCallback(async () => {
        await save();
        await saving.current;
    }, [save]);

    const schedule = useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            saving.current = save();
        }, AUTOSAVE_DELAY_MS);
    }, [save]);

    const update = useCallback((change: (current: LetterDocument) => LetterDocument) => {
        const current = letterRef.current;
        if (!current) return;
        const next = change(current);
        letterRef.current = next;
        dirty.current = true;
        setLetter(next);
        setSaveState("saving");
        schedule();
    }, [schedule]);

    // Save what is pending when the tab is hidden or the editor closes.
    useEffect(() => {
        const onHide = () => void save();
        window.addEventListener("pagehide", onHide);
        document.addEventListener("visibilitychange", onHide);
        return () => {
            window.removeEventListener("pagehide", onHide);
            document.removeEventListener("visibilitychange", onHide);
            void save();
        };
    }, [save]);

    // Another tab (or the dashboard) changed this letter and there is nothing unsaved here: follow it.
    const stored = useLiveQuery(() => db.coverLetters.get(letterId), [letterId]);
    useEffect(() => {
        if (!stored || dirty.current || inFlight.current || !letterRef.current) return;
        if (stored.updatedAt > loadedUpdatedAt.current) {
            letterRef.current = stored;
            loadedUpdatedAt.current = stored.updatedAt;
            setLetter(stored);
        }
    }, [stored]);

    const keepMine = useCallback(() => {
        if (conflict) loadedUpdatedAt.current = conflict.updatedAt;
        setConflict(null);
        dirty.current = true;
        void save();
    }, [conflict, save]);

    const loadTheirs = useCallback(() => {
        if (!conflict) return;
        letterRef.current = conflict;
        loadedUpdatedAt.current = conflict.updatedAt;
        dirty.current = false;
        setLetter(conflict);
        setConflict(null);
        setSaveState("saved");
    }, [conflict]);

    // The CV, followed live. Each result carries the id it was read for: while the letter loads
    // (or is re-pointed) the query briefly still returns the previous id's result, and treating that
    // as "no CV" would flash the missing-CV state and print the cached sender.
    const cvId = letter?.cvId ?? null;
    const cvRead = useLiveQuery(async () => ({ id: cvId, cv: await loadCv(cvId) }), [cvId]);
    const cvCurrent = cvRead !== undefined && cvRead.id === cvId;
    const cv = cvCurrent ? cvRead.cv : null;
    // Only a draft reads its CV; a frozen letter shows its own copy, so it never waits for one.
    const cvLoading = letter !== null && letter.status === "draft" && cvId !== null && !cvCurrent;

    const resolved = useMemo(() => (letter && !cvLoading ? resolveLetter(letter, cv) : null), [letter, cv, cvLoading]);

    return { loadState, letter, cv, cvLoading, resolved, saveState, conflict, update, keepMine, loadTheirs, flush };
}

"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import { useResumeStore } from "@/lib/store";
import type { Resume } from "@/lib/schema";
import { diffResume, summaryIsEmpty } from "@/lib/json-edit/diff";
import { serializeForEditing } from "@/lib/json-edit/serialize";
import { validateBuffer } from "@/lib/json-edit/validate";
import type { Problem } from "@/lib/json-edit/problems";

export interface LastApply { before: Resume; after: Resume; appliedAt: number }
type Status = "ready" | "stale" | "applying" | "undo-confirm";
const copy = (r: Resume) => structuredClone(r);
const same = (a: Resume, b: Resume) => summaryIsEmpty(diffResume(a, b));

export function useJsonBuffer() {
    const resumeId = useResumeStore(s => s.activeResumeId)!;
    const [snapshot, setSnapshot] = useState(() => copy(useResumeStore.getState().resume));
    const loaded = useRef(serializeForEditing(snapshot));
    const [text, setText] = useState(loaded.current.text);
    const context = { snapshot, photo: loaded.current.photo, resumeId };
    const [validation, setValidation] = useState(() => validateBuffer(text, context));
    const [status, setStatus] = useState<Status>("ready");
    const [lastApply, setLastApply] = useState<LastApply | null>(null);
    const [saveError, setSaveError] = useState(false);
    const baselineDb = useRef<Promise<Resume | undefined>>(Promise.resolve(undefined));
    const mounted = useRef(true);
    const busy = useRef(false);

    const load = (resume: Resume) => {
        const next = copy(resume);
        loaded.current = serializeForEditing(next);
        setSnapshot(next); setText(loaded.current.text);
        setValidation(validateBuffer(loaded.current.text, { snapshot: next, photo: loaded.current.photo, resumeId: next.id! }));
        setStatus("ready"); setSaveError(false);
        baselineDb.current = db.resumes.get(next.id!);
    };

    useEffect(() => {
        mounted.current = true;
        baselineDb.current = db.resumes.get(resumeId);
        return () => { mounted.current = false; };
    }, [resumeId]);
    const previousId = useRef(resumeId);
    useEffect(() => {
        if (previousId.current === resumeId) return;
        previousId.current = resumeId;
        load(useResumeStore.getState().resume); setLastApply(null);
        // The session resets only when its CV changes, never on live form edits.
    }, [resumeId]);
    useEffect(() => {
        const timer = setTimeout(() => setValidation(validateBuffer(text, { snapshot, photo: loaded.current.photo, resumeId })), 300);
        return () => clearTimeout(timer);
    }, [text, snapshot, resumeId]);

    const currentResume = async () => {
        const originalDb = await baselineDb.current;
        const latestDb = await db.resumes.get(resumeId);
        const current = useResumeStore.getState().resume;
        // A second tab can change the saved CV without updating this tab's store.
        return latestDb && originalDb && !same(latestDb, originalDb) && same(current, snapshot) ? latestDb : current;
    };
    /** Applies valid text directly; Undo apply is the safety net, not a review step. */
    const requestApply = async (force = false): Promise<{ problem: Problem | null; applied: boolean }> => {
        const skipped = { problem: null, applied: false };
        if (busy.current || snapshot.id !== resumeId || useResumeStore.getState().activeResumeId !== resumeId) return skipped;
        setSaveError(false);
        const next = validateBuffer(text, context);
        setValidation(next);
        if (!next.candidate) return { problem: next.problems[0] ?? null, applied: false };
        const current = await currentResume();
        if (!mounted.current || useResumeStore.getState().activeResumeId !== resumeId) return skipped;
        if (!force && !same(current, snapshot)) { setStatus("stale"); return skipped; }
        setStatus("ready");
        if (same(current, next.candidate)) {
            // Nothing to save; drop formatting-only edits so :wq can still close.
            if (text !== loaded.current.text) load(current);
            return { problem: null, applied: true };
        }
        const saved = await write(next.candidate, "json-edit");
        if (!saved || !mounted.current || useResumeStore.getState().activeResumeId !== resumeId) return skipped;
        setLastApply({ before: copy(current), after: saved, appliedAt: Date.now() }); load(saved);
        return { problem: null, applied: true };
    };

    /** Live mode: push a valid edit into the CV like a form edit; autosave persists it. */
    const applyLive = () => {
        if (busy.current || useResumeStore.getState().activeResumeId !== resumeId) return false;
        const next = validateBuffer(text, context);
        setValidation(next);
        if (!next.candidate) return false;
        const current = useResumeStore.getState().resume;
        // Something else changed the CV since the last live apply: ask, never overwrite.
        if (!same(current, snapshot)) { setStatus("stale"); return false; }
        if (!same(current, next.candidate)) useResumeStore.setState({ resume: copy(next.candidate), isDirty: true });
        // Keep the user's text and cursor; only the baseline moves.
        loaded.current = { ...loaded.current, text };
        setSnapshot(copy(next.candidate));
        return true;
    };

    const write = async (resume: Resume, trigger: "json-edit" | "restore") => {
        const previous = useResumeStore.getState();
        if (previous.activeResumeId !== resumeId) return null;
        const before = copy(previous.resume);
        busy.current = true; setStatus("applying"); setSaveError(false);
        useResumeStore.setState({ resume: copy(resume), isDirty: true, selectedDesignElementId: null, activeDesignPage: 0, previewPageCount: 1 });
        try {
            // Same save path as history restore, with resume + history committed together.
            const saved = await db.transaction("rw", db.resumes, db.resumeHistory, async () => {
                if (useResumeStore.getState().activeResumeId !== resumeId) throw new Error("JSON edit session changed");
                await useResumeStore.getState().saveToDb(trigger);
                return (await db.resumes.get(resumeId))!;
            });
            if (useResumeStore.getState().activeResumeId === resumeId && !same(useResumeStore.getState().resume, saved)) useResumeStore.setState({ isDirty: true });
            return copy(saved);
        } catch {
            if (same(useResumeStore.getState().resume, resume)) useResumeStore.setState({ resume: before, isDirty: previous.isDirty, lastSavedAt: previous.lastSavedAt });
            if (mounted.current) { setSaveError(true); setStatus("ready"); }
            return null;
        } finally { busy.current = false; }
    };

    const undoApply = async (force = false) => {
        if (busy.current || !lastApply) return;
        const current = await currentResume();
        if (useResumeStore.getState().activeResumeId !== resumeId) return;
        if (!force && !same(current, lastApply.after)) { setStatus("undo-confirm"); return; }
        const saved = await write(lastApply.before, "restore");
        if (saved && mounted.current) { setLastApply(null); load(saved); }
    };
    const reloadLatest = async () => {
        const latest = await currentResume();
        if (!same(latest, useResumeStore.getState().resume)) useResumeStore.setState({ resume: copy(latest), isDirty: false });
        load(latest);
    };
    return { text, setText, snapshot, dirty: text !== loaded.current.text, validation, status, lastApply, saveError,
        requestApply, applyLive, undoApply, reloadLatest, cancel: () => setStatus("ready") };
}

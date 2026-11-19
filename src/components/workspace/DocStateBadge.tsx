"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { DocStateChip } from "./DocStateChip";

/** The workspace state of one document, shown only when it needs attention (not when in sync, paused or outside the workspace). */
export function DocStateBadge({ docId }: { docId: string | null | undefined }) {
    const row = useLiveQuery(() => (docId ? db.workspaceDocs.get(docId) : undefined), [docId]);
    if (!row || !row.included || row.state === "in-sync" || row.state === "paused") return null;
    return <DocStateChip state={row.state} reason={row.reason} />;
}

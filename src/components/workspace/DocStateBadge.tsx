"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { DocStateChip } from "./DocStateChip";

/** The workspace state of one document: a chip when it needs attention or was left out of the folder, nothing when it is in sync. */
export function DocStateBadge({ docId }: { docId: string | null | undefined }) {
    const row = useLiveQuery(() => (docId ? db.workspaceDocs.get(docId) : undefined), [docId]);
    if (!row) return null;
    if (!row.included) return <DocStateChip state={row.state} excluded />;
    if (row.state === "in-sync" || row.state === "paused") return null;
    return <DocStateChip state={row.state} reason={row.reason} />;
}

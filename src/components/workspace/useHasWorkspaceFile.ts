"use client";

import { useEffect, useState } from "react";
import { documentHasWorkspaceFile } from "@/lib/workspace/controller";

/** Whether deleting this document should ask about its file in the workspace folder. */
export function useHasWorkspaceFile(docId: string | null | undefined): boolean {
    const [has, setHas] = useState(false);
    useEffect(() => {
        let alive = true;
        if (!docId) {
            queueMicrotask(() => alive && setHas(false));
        } else {
            void documentHasWorkspaceFile(docId).then((value) => alive && setHas(value));
        }
        return () => {
            alive = false;
        };
    }, [docId]);
    return has;
}

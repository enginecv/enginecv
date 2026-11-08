"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { listenForWipe } from "@/lib/storage-registry/cross-tab";

// Loaded only when another tab starts deleting, so every page stays as light as before.
const OtherTabWipeNotice = dynamic(() => import("./OtherTabWipeNotice"), { ssr: false });

/**
 * Mounted on every page. When another EngineCV tab runs "delete all my
 * data", this tab stops saving and closes the database (so the delete is not
 * blocked and nothing is written back), then reloads once it is done.
 */
export function WipeListener() {
    const [wiping, setWiping] = useState(false);

    useEffect(() => listenForWipe({
        onStart: () => {
            setWiping(true);
            void Promise.all([
                import("@/lib/store"),
                import("@/lib/db"),
                import("@/lib/preferences/store"),
            ]).then(([{ useResumeStore }, { closeDatabaseForDeletion }, { suspendPreferencePersistence }]) => {
                suspendPreferencePersistence();
                useResumeStore.getState().suspendPersistence();
                closeDatabaseForDeletion();
            });
        },
        onDone: () => window.location.reload(),
    }), []);

    return wiping ? <OtherTabWipeNotice /> : null;
}

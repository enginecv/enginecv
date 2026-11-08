"use client";

import { useSearchParams } from "next/navigation";
import { DeleteDataCard } from "./DeleteDataCard";
import { DownloadDataCard } from "./DownloadDataCard";
import { YourDataContent } from "./YourDataContent";

export function YourDataPage() {
    // ?action=delete opens the delete dialog, ?action=download focuses the download
    // (links from the dashboard and the editor palette).
    const action = useSearchParams().get("action");
    return (
        <YourDataContent
            actions={({ ts }) => (
                <div className="grid gap-4 md:grid-cols-2">
                    <DownloadDataCard ts={ts} focusOnMount={action === "download"} />
                    <DeleteDataCard ts={ts} initiallyOpen={action === "delete"} />
                </div>
            )}
        />
    );
}

"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// The page is entirely client state (IndexedDB), so the server would only ever render this
// spinner. ssr:false keeps the editor out of the Worker bundle, like the CV editor.
const ClientPage = dynamic(() => import("./ClientPage"), {
    ssr: false,
    loading: () => (
        <div className="flex min-h-screen items-center justify-center bg-surface-2">
            <Loader2 className="h-6 w-6 animate-spin text-strong" />
        </div>
    ),
});

export default function ClientLoader({ params }: { params: Promise<{ id: string }> }) {
    return <ClientPage params={params} />;
}

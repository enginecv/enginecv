"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// The page is entirely client state (IndexedDB), so the server would only
// ever render this spinner. Loading the module with ssr:false keeps the large
// editor graph out of the Worker bundle, which cuts cold-start and per-request
// CPU on Cloudflare's 10 ms free-plan limit.
const ClientPage = dynamic(() => import("./ClientPage"), {
    ssr: false,
    loading: () => (
        <div className="min-h-screen bg-surface-2 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-strong animate-spin" />
        </div>
    ),
});

export default function ClientLoader({ params }: { params: Promise<{ id: string }> }) {
    return <ClientPage params={params} />;
}

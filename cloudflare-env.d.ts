// Cloudflare Worker bindings exposed to Next.js routes via @opennextjs/cloudflare.
// Regenerate with `npm run cf:typegen` if bindings change.

import type { AnalyticsEngineDataset, KVNamespace } from "@cloudflare/workers-types";

declare global {
    interface CloudflareEnv {
        REFERRALS: KVNamespace;
        EVENTS?: AnalyticsEngineDataset;
        REFERRAL_ADMIN_TOKEN?: string;
    }
}

export {};

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Browser state every `chromium` test starts from: the visitor has already
 * declined ads. Local `.env` files may enable ads, and an unanswered consent
 * prompt would otherwise cover controls in unrelated product tests. The prompt
 * itself is covered by the `chromium-ads` project and integration tests; the
 * privacy contract resets to an empty state to test a genuine first visit.
 */
export const CONSENT_DECIDED_STATE_PATH = "e2e/.state/consent-decided.json";

export function writeConsentDecidedState(baseURL: string) {
    const origin = new URL(baseURL).origin;
    const state = {
        cookies: [],
        origins: [
            {
                origin,
                localStorage: [
                    {
                        name: "enginecv-consent",
                        value: JSON.stringify({ version: 2, ads: "denied", decidedAt: "2026-01-01T00:00:00.000Z" }),
                    },
                ],
            },
        ],
    };
    mkdirSync(dirname(CONSENT_DECIDED_STATE_PATH), { recursive: true });
    writeFileSync(CONSENT_DECIDED_STATE_PATH, JSON.stringify(state, null, 2));
}

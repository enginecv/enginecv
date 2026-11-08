import type { Metadata } from "next";
import Link from "next/link";
import { AdConsentManager } from "@/components/integrations/AdConsentManager";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { pageMetadata } from "@/lib/site";
import { STORAGE_REGISTRY, type RegistryEntry } from "@/lib/storage-registry/registry";
import { en as storageMessages } from "@/lib/storage-registry/messages/en";

export const metadata: Metadata = pageMetadata({
    title: "Cookie and Storage Policy | EngineCV",
    description: "Every cookie and browser storage entry EngineCV uses, and how to manage ad consent.",
    path: "/cookies",
});

// The policy lists exactly what the registry lists (English page, English texts).
const entries: readonly RegistryEntry[] = STORAGE_REGISTRY;
const cookies = entries.filter((entry) => entry.status === "active" && entry.location === "cookie");
const storage = entries.filter((entry) => entry.status === "active" && entry.location !== "cookie");
const legacy = entries.filter((entry) => entry.status === "legacy");

function RegistryItem({ entry }: { entry: RegistryEntry }) {
    const where = entry.location === "indexeddb-table" ? `${storageMessages[`storage.location.${entry.location}`]} ${entry.database}` : storageMessages[`storage.location.${entry.location}`];
    return (
        <li>
            <code>{entry.name}</code> ({where}, {storageMessages[`storage.owner.${entry.owner}`]}): {storageMessages[`storage.purpose.${entry.id}`]}{" "}
            {storageMessages[`storage.basis.${entry.legalBasis}`]}. Kept: {storageMessages[`storage.retention.${entry.retention}`].toLowerCase()}.
        </li>
    );
}

export default function CookiesPage() {
    return (
        <LegalPage
            eyebrow="EngineCV Legal"
            title="Cookie and Storage Policy"
            description="EngineCV uses one functional cookie of its own and browser storage for your own data. Its page analytics are cookieless, and ad cookies only exist if you allow ads."
        >
            <LegalSection title="1. Cookies">
                <ul className="list-disc space-y-2 pl-6" data-testid="cookie-policy-cookies">
                    {cookies.map((entry) => <RegistryItem key={entry.id} entry={entry} />)}
                </ul>
                <p>
                    EngineCV sets no analytics cookies and no referral cookies: the page analytics it uses (Cloudflare Web
                    Analytics, see the <Link href="/privacy" className="underline">Privacy Policy</Link>) are cookieless and store
                    nothing on your device. Ads are currently off on enginecv.app. Cookies that a third party set on its own
                    domain can only be removed in your browser settings.
                </p>
            </LegalSection>

            <LegalSection title="2. Browser storage">
                <ul className="list-disc space-y-2 pl-6" data-testid="cookie-policy-storage">
                    {storage.map((entry) => <RegistryItem key={entry.id} entry={entry} />)}
                </ul>
                <p>
                    This data stays on your device. Left over from older versions and removed automatically:{" "}
                    {legacy.map((entry, index) => (
                        <span key={entry.id}>{index > 0 && ", "}<code>{entry.pattern ? `${entry.name}*` : entry.name}</code></span>
                    ))}.
                </p>
                <p>
                    See everything stored in your browser right now, download a copy, or delete all of it on{" "}
                    <Link href="/your-data" className="underline">Your data</Link>.
                </p>
            </LegalSection>

            <LegalSection title="3. Your ad consent">
                <p>
                    Nothing ad-related loads until you allow ads. You can allow or withdraw consent here at any time.
                </p>
                <AdConsentManager />
            </LegalSection>

            <LegalSection title="4. Managing cookies and storage">
                <p>
                    You can also delete cookies and site data in your browser settings. Doing so resets your language, preferences,
                    and ad choice, and removes locally saved resumes.
                </p>
            </LegalSection>
        </LegalPage>
    );
}

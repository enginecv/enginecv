import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { LEGAL_OPERATOR, isLegalNoticeReady, type LegalOperator } from "@/lib/legal-operator";
import { pageMetadata } from "@/lib/site";

const TITLE = "Impressum / Legal notice | EngineCV";
const DESCRIPTION = "Who operates EngineCV and how to reach them.";

export const metadata: Metadata = isLegalNoticeReady()
    ? pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/impressum" })
    : { title: TITLE, description: DESCRIPTION, robots: { index: false, follow: false } };

function Field({ value }: { value: string | null }) {
    if (value) return <>{value}</>;
    return <span className="rounded bg-surface-4 px-1.5 font-mono text-sm text-faint">TODO</span>;
}

function Row({ label, field }: { label: string; field: keyof LegalOperator }) {
    return (
        <div className="grid gap-1 sm:grid-cols-[14rem_1fr]">
            <dt className="text-faint">{label}</dt>
            <dd><Field value={LEGAL_OPERATOR[field]} /></dd>
        </div>
    );
}

export default function ImpressumPage() {
    return (
        <LegalPage
            eyebrow="EngineCV Legal"
            title="Impressum / Legal notice"
            description="Provider identification for enginecv.app."
        >
            <LegalSection title="Provider">
                <dl className="space-y-3">
                    <Row label="Name" field="name" />
                    <Row label="Address" field="street" />
                    <Row label="Postal code and city" field="postalCodeAndCity" />
                    <Row label="Country" field="country" />
                </dl>
            </LegalSection>

            <LegalSection title="Contact">
                <dl className="space-y-3">
                    <Row label="Email" field="email" />
                    {LEGAL_OPERATOR.phone ? <Row label="Phone" field="phone" /> : null}
                </dl>
            </LegalSection>

            {LEGAL_OPERATOR.vatId ? (
                <LegalSection title="VAT">
                    <dl className="space-y-3">
                        <Row label="VAT identification number" field="vatId" />
                    </dl>
                </LegalSection>
            ) : null}

            {LEGAL_OPERATOR.responsibleForContent ? (
                <LegalSection title="Responsible for content">
                    <p><Field value={LEGAL_OPERATOR.responsibleForContent} /></p>
                </LegalSection>
            ) : null}
        </LegalPage>
    );
}

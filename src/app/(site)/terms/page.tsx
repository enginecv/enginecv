import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
    title: "Terms of Service | EngineCV",
    description: "Basic terms for using EngineCV as a local-first resume builder.",
    path: "/terms",
});

export default function TermsPage() {
    return (
        <LegalPage
            eyebrow="EngineCV Legal"
            title="Terms of Service"
            description="These terms cover EngineCV, a local-first resume builder with no accounts."
        >
            <LegalSection title="1. What EngineCV is">
                <p>
                    EngineCV is software for drafting, editing, and exporting resume content. It is not legal advice,
                    employment advice, or a guarantee that any resume will lead to interviews or job offers.
                </p>
            </LegalSection>

            <LegalSection title="2. Your responsibility for content">
                <p>
                    You are responsible for the resume content you create, import, export, or share through the app.
                    That includes checking facts, dates, claims, formatting, and the final output before sending it to employers.
                </p>
            </LegalSection>

            <LegalSection title="3. Local storage and backups">
                <p>
                    The core product is designed to keep working data in your browser. Because of that, you should export
                    and back up important resumes yourself. EngineCV is not responsible for data loss caused by cleared browser
                    storage, device issues, or changes to your local environment.
                </p>
            </LegalSection>

            <LegalSection title="4. Third-party services">
                <p>
                    Some features rely on third parties, such as GitHub for profile import and Google Fonts for resume previews.
                    EngineCV cannot guarantee their availability or behavior. AI writing features are not available today.
                </p>
            </LegalSection>

            <LegalSection title="5. Availability and changes">
                <p>
                    EngineCV may change, pause, remove, or re-scope features at any time, especially while the product is still
                    being prepared for broader launch. Public copy and legal pages describe the shipped product and do not promise
                    unreleased capabilities.
                </p>
            </LegalSection>

            <LegalSection title="6. No warranty">
                <p>
                    EngineCV is provided on an as-is basis without warranties of availability, fitness for a particular purpose,
                    or uninterrupted operation. Use it with the expectation that you should verify outputs and maintain your own backups.
                </p>
            </LegalSection>
        </LegalPage>
    );
}

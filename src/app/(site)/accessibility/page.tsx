import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
    title: "Accessibility Statement | EngineCV",
    description: "How accessible EngineCV is today, how it is tested, and the issues that are still open.",
    path: "/accessibility",
});

export default function AccessibilityPage() {
    return (
        <LegalPage
            eyebrow="EngineCV Legal"
            title="Accessibility Statement"
            description="EngineCV aims to meet WCAG 2.1 level AA. This page says what is tested automatically, what was fixed, and what is still open."
        >
            <LegalSection title="1. Target">
                <p>
                    EngineCV targets <strong>WCAG 2.1 level AA</strong> for the application: the home page, the dashboard, the
                    resume editor, the export and import dialogs, and the legal pages.
                </p>
            </LegalSection>

            <LegalSection title="2. How this is tested">
                <ul className="list-disc space-y-2 pl-6">
                    <li>
                        Automated axe checks run in the test suite on the home page, dashboard, editor (content, entry form,
                        customize panel), export dialog, Europass import dialog and legal pages, in both the dark and light
                        themes. Serious or critical findings fail the build.
                    </li>
                    <li>
                        A keyboard-only test creates a resume, edits it and exports a file without a mouse, checking that focus
                        stays visible and returns to the right control after dialogs close.
                    </li>
                    <li>
                        A unit test checks every colour in the theme against every background for the 4.5:1 contrast minimum, in
                        both themes.
                    </li>
                </ul>
            </LegalSection>

            <LegalSection title="3. Fixed in the September 2026 pass">
                <ul className="list-disc space-y-2 pl-6">
                    <li>Text colours across both themes now meet the 4.5:1 contrast minimum.</li>
                    <li>Editor fields, the description editor, icon-only buttons and import drop zones have proper names and labels.</li>
                    <li>Dialogs take focus when they open, keep Tab inside, close with Escape and return focus to the control that opened them.</li>
                    <li>A &quot;Skip to main content&quot; link is the first thing you reach with the keyboard, and keyboard focus is always visible.</li>
                </ul>
            </LegalSection>

            <LegalSection title="4. Known issues">
                <ul className="list-disc space-y-2 pl-6">
                    <li>
                        <strong>Legal pages are English only.</strong> The app interface is available in English, Bosnian, German,
                        French and Spanish, but this page and the privacy, cookies and terms pages are not translated yet.
                    </li>
                    <li>
                        <strong>The description editor is a third-party component.</strong> Its toolbar buttons are named and its
                        icons are hidden from screen readers, but its Markdown preview and drag handle have not been fully audited.
                    </li>
                    <li>
                        <strong>Exported PDFs are not tagged.</strong> The text is selectable and reads in the right order, but the
                        files carry no PDF structure tags, so screen readers cannot use headings inside them.
                    </li>
                    <li>
                        <strong>Screen-reader testing is not complete.</strong> The automated checks cannot confirm how the editor
                        sounds in practice; a manual NVDA pass is planned, and findings will be listed here.
                    </li>
                    <li>
                        <strong>The resume preview zoom controls appear on hover or keyboard focus.</strong> They are reachable by
                        keyboard, but are not visible until focused.
                    </li>
                </ul>
            </LegalSection>

            <LegalSection title="5. Feedback">
                <p>
                    If something is unusable for you, please tell us through the <Link href="/contact" className="underline">contact
                    page</Link> and say which page and which assistive technology you use. Accessibility problems are treated as
                    defects, not feature requests.
                </p>
            </LegalSection>
        </LegalPage>
    );
}

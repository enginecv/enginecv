import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { ABOUT_META, ABOUT_SECTIONS } from "@/lib/about/content";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
    title: ABOUT_META.title,
    description: ABOUT_META.description,
    path: "/about",
});

export default function AboutPage() {
    return (
        <LegalPage eyebrow={ABOUT_META.eyebrow} title={ABOUT_META.heading} description={ABOUT_META.intro}>
            {ABOUT_SECTIONS.map((section) => (
                <LegalSection key={section.id} title={section.heading}>
                    {section.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                    ))}
                    {section.links?.map((link) => (
                        <p key={link.href}>
                            <a
                                href={link.href}
                                target="_blank"
                                rel="noreferrer"
                                className="underline underline-offset-4 hover:text-strong"
                            >
                                {link.label}
                            </a>
                        </p>
                    ))}
                    {section.id === "contact" ? (
                        <p>
                            <Link href="/contact" className="underline underline-offset-4 hover:text-strong">
                                Contact page
                            </Link>
                        </p>
                    ) : null}
                </LegalSection>
            ))}
        </LegalPage>
    );
}

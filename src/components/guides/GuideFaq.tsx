import { ChevronDown } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { GUIDE_COPY } from "@/lib/guides/copy";
import type { GuideFaqItem } from "@/lib/guides/guides";
import { guideFaqJsonLd } from "@/lib/structured-data";

/** The visible FAQ and its FAQPage structured data, both read from the guide's front matter. */
export function GuideFaq({ faq }: { faq: readonly GuideFaqItem[] }) {
    if (faq.length === 0) return null;

    return (
        <section className="mt-14" aria-labelledby="guide-faq">
            <JsonLd nodes={[guideFaqJsonLd(faq)]} />
            <h2 id="guide-faq" className="text-2xl font-semibold tracking-tight text-strong">
                {GUIDE_COPY.faqTitle}
            </h2>
            <div className="mt-5 divide-y divide-edge rounded-2xl border border-edge bg-surface-3">
                {faq.map(({ q, a }) => (
                    <details key={q} className="group px-5 py-4">
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium text-strong [&::-webkit-details-marker]:hidden">
                            {q}
                            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-faint transition-transform group-open:rotate-180" aria-hidden="true" />
                        </summary>
                        <p className="mt-3 text-sm leading-7 text-mid">{a}</p>
                    </details>
                ))}
            </div>
        </section>
    );
}

import { ChevronDown } from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import { translate } from "@/lib/i18n/translate";
import type { ToolFaqKey } from "@/lib/tools/registry";

/** The visible FAQ. FAQPage structured data reads the same keys. */
export function ToolFaq({ locale, keys }: { locale: Locale; keys: readonly ToolFaqKey[] }) {
    return (
        <section className="mt-16" aria-labelledby="tool-faq">
            <h2 id="tool-faq" className="text-xl font-semibold">{translate(locale, "tools.faqTitle")}</h2>
            <div className="mt-5 divide-y divide-edge rounded-2xl border border-edge bg-surface-3">
                {keys.map(({ q, a }) => (
                    <details key={q} className="group px-5 py-4">
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium text-strong [&::-webkit-details-marker]:hidden">
                            {translate(locale, q)}
                            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-faint transition-transform group-open:rotate-180" aria-hidden="true" />
                        </summary>
                        <p className="mt-3 text-sm leading-7 text-mid">{translate(locale, a)}</p>
                    </details>
                ))}
            </div>
        </section>
    );
}

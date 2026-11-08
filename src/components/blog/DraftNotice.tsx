import { translateBlog } from "@/lib/blog-i18n";
import type { Locale } from "@/lib/i18n/locales";

/** Shown on a translation that native speakers are still reviewing; the page is also noindex. */
export function DraftNotice({ locale }: { locale: Locale }) {
    return (
        <p
            role="note"
            data-testid="blog-draft-notice"
            className="mb-8 rounded-2xl border border-warning-tint2 bg-warning-tint px-4 py-3 text-sm leading-6 text-strong"
        >
            {translateBlog(locale, "draftNotice")}
        </p>
    );
}

import { toDocumentModel } from "@/lib/document-model";
import { toHtmlFragment } from "@/lib/export-html-fragment";
import type { Resume } from "@/lib/schema";

/**
 * The example CV as plain, semantic HTML for the page body. Crawlers and screen
 * readers get the real CV text even before the visual preview loads, and the
 * preview itself never has to be server-rendered.
 *
 * The fragment's headings are demoted two levels (h1 to h3, h2 to h4) because
 * the page already owns h1 and h2.
 */
export function demoteHeadings(html: string): string {
    return html.replace(/<(\/?)h([12])\b/g, (_match, slash: string, level: string) => `<${slash}h${Number(level) + 2}`);
}

export function exampleTextHtml(resume: Resume, accent: string): string {
    return demoteHeadings(toHtmlFragment(toDocumentModel(resume), accent));
}

import { expect, test, type Page } from "@playwright/test";
import { extractText } from "unpdf";
import { recordParseCase, reportRequested, type ParseCase } from "./helpers/parse-report";
import { checkExtractedText, expectedFieldsInOrder, normalizeExtractedText } from "../src/lib/qa/parse-check";
import { QA_RESUME_FIXTURES } from "../src/lib/qa/sample-resumes";
import { resumeSchema, type Resume } from "../src/lib/schema";
import { getBuiltinTemplates } from "../src/lib/templates/enginecv-templates";
import { applyTemplateToResume } from "../src/lib/templates/template-apply";
import { templateDocumentSchema } from "../src/lib/templates/template-schema";

/**
 * PDF parse-ability matrix (contracts/quality-gates.md §B): every built-in
 * template, rendered with every QA fixture, exported the way the app exports it,
 * then read back with a PDF text extractor.
 *
 * Two checks per case:
 *  1. Every expected field the template renders is in the extracted text, with
 *     section and entry anchors in order.
 *  2. Every line of the rendered page is in the extracted text — this catches
 *     text a template turns unreadable (images, clipping, reading order) even
 *     when the field check happens to find the same words elsewhere.
 *
 * Expected fields a template does not render (visibility settings, or values the
 * preview formats differently) are reported, not failed: what is under test here
 * is the exported PDF, not what the preview chooses to show.
 */

const templates = getBuiltinTemplates();

/**
 * Chromium writes right-to-left runs into the PDF in visual order, so extractors
 * read them back reversed and in presentation forms. That is an extractor-side
 * limitation rather than a template defect, so RTL runs are dropped from both
 * sides of every comparison.
 */
const RTL_RUN = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}]+/gu;

function comparable(value: string): string {
    return normalizeExtractedText(value.replace(RTL_RUN, " "));
}

/**
 * Letters and digits only. Line breaks inside a word or a hyphenated name come
 * back from the extractor with the break left in ("Šehić-\nĐurić"), which says
 * nothing about whether the text is readable, so the line-coverage check
 * compares squashed text.
 */
function squashed(value: string): string {
    return comparable(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * Groups section keys by the column they are rendered in, taken from the page
 * itself rather than from the layout rules. A column layout reads as one flow
 * per column, so order is only checked inside a column
 * (contracts/quality-gates.md §B).
 */
function orderGroupsFrom(columns: Array<{ key: string; column: number }>): string[][] | undefined {
    if (columns.length === 0) return undefined;

    const groups = new Map<number, string[]>();
    for (const { key, column } of columns) {
        groups.set(column, [...(groups.get(column) ?? []), key]);
    }
    if (groups.size === 1) return undefined;

    return [["basics"], ...groups.values()];
}

function resumeForCase(templateId: string, createFixture: () => Resume): Resume {
    const template = templateDocumentSchema.parse(templates.find((entry) => entry.id === templateId));
    const { resume } = applyTemplateToResume(createFixture(), template);
    const now = Date.UTC(2026, 0, 1);
    return resumeSchema.parse({ ...resume, id: `parse-${templateId}`, createdAt: now, updatedAt: now });
}

/** Writes the resume straight into the app's database, as an import would. */
async function seedResume(page: Page, resume: Resume) {
    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-new-resume")).toBeVisible();

    // The app creates the database on its first load, and its stores only exist
    // once that version upgrade has run, so the write is retried until it lands.
    await expect.poll(
        () => page.evaluate(async (stored) => {
            try {
                const database = await new Promise<IDBDatabase>((resolve, reject) => {
                    const request = indexedDB.open("EngineCVDatabase");
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                if (!database.objectStoreNames.contains("resumes")) {
                    database.close();
                    return "no store yet";
                }
                await new Promise<void>((resolve, reject) => {
                    const request = database.transaction("resumes", "readwrite").objectStore("resumes").put(stored);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
                database.close();
                return "stored";
            } catch (error) {
                return String(error);
            }
        }, resume as unknown as Record<string, unknown>),
        { timeout: 30_000, message: "seeding the resume into IndexedDB" },
    ).toBe("stored");
}

/** Opens the resume, returning its rendered lines and the printable HTML the PDF export prints. */
async function renderAndExport(page: Page, resume: Resume) {
    await page.goto(`/editor/${resume.id}`);
    const firstPage = page.locator(".resume-page").first();
    await expect(firstPage).toBeVisible();
    await expect(firstPage).toContainText(resume.basics.name.split(" ")[0]);

    // Where each section sits across the page, so a two-column layout can be
    // checked one column at a time. Rounded to 20px so a section that starts a
    // little indented still counts as the same column.
    const sectionColumns = await page.evaluate(() => {
        const nodes = document.querySelectorAll<HTMLElement>("[data-nav-section][data-nav-kind='heading']");
        return [...nodes].map((node) => ({
            key: node.getAttribute("data-nav-section") ?? "",
            column: Math.round(node.getBoundingClientRect().x / 20) * 20,
        }));
    });

    const renderedLines = (await page.locator(".resume-page").allInnerTexts())
        .flatMap((pageText) => pageText.split("\n"))
        .map((line) => line.trim())
        .filter((line) => line.length >= 4);

    await page.getByTestId("export-menu-button").first().click();
    await page.getByTestId("export-format-html").click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-confirm-button").click();
    const stream = await (await downloadPromise).createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);

    return { renderedLines, sectionColumns, html: Buffer.concat(chunks).toString("utf8") };
}

async function pdfTextOf(page: Page, html: string): Promise<string> {
    // Same origin as the app, so the document's stylesheet and font links resolve.
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const { text } = await extractText(new Uint8Array(pdf), { mergePages: true });
    return text;
}

async function runCase(page: Page, templateId: string, fixtureId: string, createFixture: () => Resume) {
    const resume = resumeForCase(templateId, createFixture);
    await seedResume(page, resume);
    const { renderedLines, sectionColumns, html } = await renderAndExport(page, resume);
    const extracted = comparable(await pdfTextOf(page, html));
    const rendered = comparable(renderedLines.join(" "));

    const expected = expectedFieldsInOrder(resume)
        .map((field) => ({ ...field, text: comparable(field.text) }))
        .filter((field) => field.text);
    const onPage = expected.filter((field) => rendered.includes(field.text));
    const notRendered = expected.filter((field) => !rendered.includes(field.text)).map((field) => field.text);

    const checked = checkExtractedText(extracted, onPage, { orderGroups: orderGroupsFrom(sectionColumns) });
    const squashedExtract = squashed(extracted);

    // A word broken across lines comes back with the break in it ("property-\nbased",
    // a long token wrapped mid-word), which every PDF does and which leaves the text
    // readable. Only text that is absent from the squashed extraction is missing.
    const missingFields = checked.missingFields.filter((field) => !squashedExtract.includes(squashed(field)));
    const result = {
        ...checked,
        missingFields,
        pass: missingFields.length === 0 && checked.orderErrors.length === 0 && checked.leakedFields.length === 0,
    };

    const unextractable = renderedLines
        .filter((line) => squashed(line) && !squashedExtract.includes(squashed(line)))
        .map(comparable);

    const parseCase: ParseCase = { templateId, fixtureId, result, unextractable, notRendered };
    if (reportRequested()) await recordParseCase(parseCase);
    return parseCase;
}

for (const template of templates) {
    test(`text extracts from ${template.id} PDFs`, async ({ page }) => {
        const problems: string[] = [];

        for (const fixture of QA_RESUME_FIXTURES) {
            const { result, unextractable } = await runCase(page, template.id, fixture.id, fixture.create);
            if (!result.pass) {
                const fields = { missing: result.missingFields, order: result.orderErrors, leaked: result.leakedFields };
                problems.push(`${fixture.id} fields: ${JSON.stringify(fields, null, 2)}`);
            }
            if (unextractable.length > 0) {
                problems.push(`${fixture.id} not extractable: ${JSON.stringify(unextractable, null, 2)}`);
            }
        }

        expect(problems.join("\n"), `${template.id} PDF text extraction`).toBe("");
    });
}

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ParseCheckResult } from "../../src/lib/qa/parse-check";

/**
 * Collects the PDF parse-ability matrix into `parse-results.md`.
 *
 * Playwright starts a fresh worker process after a failing test, which loses any
 * state the spec kept in memory, so each case is written to its own file as it
 * runs and the report is assembled in the global teardown.
 */

export interface ParseCase {
    templateId: string;
    fixtureId: string;
    result: ParseCheckResult;
    /** Rendered lines that never made it into the extracted text. */
    unextractable: string[];
    /** Expected fields the preview does not render at all. */
    notRendered: string[];
}

// Outside test-results, which Playwright wipes at the start of a run.
const CASE_DIR = join(tmpdir(), "enginecv-parse-cases");
const REPORT_PATH = "specs/022-trust-baseline/parse-results.md";

/** Set by the runner (`UPDATE_PARSE_REPORT=1`) to regenerate the committed report. */
export function reportRequested(): boolean {
    return Boolean(process.env.UPDATE_PARSE_REPORT);
}

export async function resetParseCases() {
    await rm(CASE_DIR, { recursive: true, force: true });
    await mkdir(CASE_DIR, { recursive: true });
}

export async function recordParseCase(parseCase: ParseCase) {
    await mkdir(CASE_DIR, { recursive: true });
    const name = `${parseCase.templateId}--${parseCase.fixtureId}.json`;
    await writeFile(join(CASE_DIR, name), JSON.stringify(parseCase), "utf8");
}

async function readParseCases(order: string[]): Promise<ParseCase[]> {
    const files = await readdir(CASE_DIR).catch(() => [] as string[]);
    const cases = await Promise.all(
        files
            .filter((file) => file.endsWith(".json"))
            .map(async (file) => JSON.parse(await readFile(join(CASE_DIR, file), "utf8")) as ParseCase),
    );
    return cases.sort((left, right) => {
        const byTemplate = order.indexOf(left.templateId) - order.indexOf(right.templateId);
        return byTemplate !== 0 ? byTemplate : left.fixtureId.localeCompare(right.fixtureId);
    });
}

function passed(parseCase: ParseCase): boolean {
    return parseCase.result.pass && parseCase.unextractable.length === 0;
}

function row({ templateId, fixtureId, result, unextractable, notRendered }: ParseCase): string {
    const problems = [
        result.missingFields.length ? `${result.missingFields.length} missing` : "",
        result.orderErrors.length ? `${result.orderErrors.length} out of order` : "",
        result.leakedFields.length ? "hidden content leaked" : "",
        unextractable.length ? `${unextractable.length} lines not extractable` : "",
    ].filter(Boolean).join(", ");
    const verdict = passed({ templateId, fixtureId, result, unextractable, notRendered }) ? "pass" : "fail";
    return `| ${templateId} | ${fixtureId} | ${verdict} | ${problems || "none"} | ${notRendered.length} |`;
}

function detail({ templateId, fixtureId, result, unextractable }: ParseCase): string {
    return [
        `### ${templateId} — ${fixtureId}`,
        "",
        ...result.missingFields.map((field) => `- missing: \`${field}\``),
        ...result.orderErrors.map(([first, second]) => `- out of order: \`${first}\` should precede \`${second}\``),
        ...result.leakedFields.map((field) => `- leaked: \`${field}\``),
        ...unextractable.map((line) => `- rendered but not extractable: \`${line}\``),
        "",
    ].join("\n");
}

/** Writes the Markdown report, or returns false when the run recorded nothing. */
export async function writeParseReport(templateOrder: string[]): Promise<boolean> {
    const cases = await readParseCases(templateOrder);
    if (cases.length === 0) return false;

    const report = [
        "# PDF Text Extraction Results",
        "",
        `**Generated**: \`UPDATE_PARSE_REPORT=1 npm run test:parse\` on ${new Date().toISOString().slice(0, 10)}`,
        "**Method**: each template is applied to each QA fixture, exported through the app's HTML export (the printable document the PDF export prints), printed to PDF by Chromium and read back with `unpdf`. A case passes when every rendered field is in the extracted text, section and entry anchors are in order, no hidden content leaks, and every rendered line is extractable.",
        "**Not rendered**: expected fields the preview does not show for that template — hidden by a visibility setting, or written differently by the preview than by the data model. Counted for review, not failed; the systematic cases are listed in `baseline.md`.",
        "**Right-to-left text is excluded**: Chromium writes RTL runs into the PDF in visual order, so extractors read them back reversed. That is an extractor limitation, not a template defect.",
        "",
        `**Result**: ${cases.filter(passed).length}/${cases.length} cases pass.`,
        "",
        "| Template | Fixture | Result | Problems | Not rendered |",
        "|---|---|---|---|---|",
        ...cases.map(row),
        "",
        ...(cases.some((parseCase) => !passed(parseCase))
            ? ["## Failures", "", ...cases.filter((parseCase) => !passed(parseCase)).map(detail)]
            : ["No failures."]),
        "",
    ].join("\n");

    await writeFile(REPORT_PATH, report, "utf8");
    return true;
}

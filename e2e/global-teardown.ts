import { getBuiltinTemplates } from "../src/lib/templates/enginecv-templates";
import { reportRequested, writeParseReport } from "./helpers/parse-report";

/** Assembles the PDF parse-ability report once every worker has finished. */
export default async function globalTeardown() {
    if (!reportRequested()) return;

    const written = await writeParseReport(getBuiltinTemplates().map((template) => template.id));
    if (written) console.log("[parse] wrote specs/022-trust-baseline/parse-results.md");
}

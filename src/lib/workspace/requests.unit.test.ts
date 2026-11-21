import { describe, expect, it } from "vitest";
import { newDocRow } from "./workspace-store";
import { REQUEST_KEEP_MS, RESULTS_CAP, checkRequest, cleanupPlan, exportFileName, failure, formatsFor, requestIdOf, resolveTarget, success } from "./requests";

const good = { id: "abc-1", action: "export", target: "cv-1", format: "html" };

describe("requests", () => {
    it("reads the id from the file name, and ignores other files", () => {
        expect(requestIdOf("6f0e.request.json")).toBe("6f0e");
        expect(requestIdOf("6f0e.result.json")).toBeNull();
        expect(requestIdOf("../x.request.json")).toBeNull();
        expect(requestIdOf(".request.json")).toBeNull();
    });

    it("accepts a well-formed request, with or without paper", () => {
        expect(checkRequest("abc-1", JSON.stringify(good))).toEqual({ ok: true, request: { ...good, action: "export" } });
        expect(checkRequest("abc-1", JSON.stringify({ ...good, paper: "letter" }))).toMatchObject({ ok: true, request: { paper: "letter" } });
    });

    it("says what is wrong, in one line, and marks an unfinished file as incomplete", () => {
        expect(checkRequest("abc-1", "")).toMatchObject({ ok: false, code: "request-invalid", incomplete: true });
        expect(checkRequest("abc-1", '{"id": "abc')).toMatchObject({ ok: false, incomplete: true });
        expect(checkRequest("abc-1", "[]")).toMatchObject({ ok: false, code: "request-invalid" });
        expect(checkRequest("abc-1", JSON.stringify({ ...good, id: "other" }))).toMatchObject({ ok: false, message: expect.stringContaining("abc-1") });
        expect(checkRequest("abc-1", JSON.stringify({ ...good, action: "delete" }))).toMatchObject({ ok: false, message: expect.stringContaining("export") });
        expect(checkRequest("abc-1", JSON.stringify({ ...good, target: "" }))).toMatchObject({ ok: false });
        expect(checkRequest("abc-1", JSON.stringify({ ...good, format: undefined }))).toMatchObject({ ok: false });
        expect(checkRequest("abc-1", JSON.stringify({ ...good, paper: "a3" }))).toMatchObject({ ok: false });
        const refused = checkRequest("abc-1", JSON.stringify({ ...good, action: "delete" }));
        if (!refused.ok) expect(refused.incomplete).toBeUndefined();
    });

    it("finds a document by id or by file path, ignoring case and slash style", () => {
        const rows = [newDocRow({ docId: "cv-1", kind: "cv", fileName: "Master CV.cv.json" }, 1), newDocRow({ docId: "l-1", kind: "letter", fileName: "Acme.letter.json" }, 1)];
        expect(resolveTarget("cv-1", rows)?.docId).toBe("cv-1");
        expect(resolveTarget("cvs/master cv.cv.json", rows)?.docId).toBe("cv-1");
        expect(resolveTarget("./letters\\Acme.letter.json", rows)?.docId).toBe("l-1");
        expect(resolveTarget("nope", rows)).toBeNull();
    });

    it("offers JSON only for CVs", () => {
        expect(formatsFor("cv")).toContain("json");
        expect(formatsFor("letter")).not.toContain("json");
        expect(formatsFor("letter")).toEqual(expect.arrayContaining(["html", "docx", "md", "txt", "tex"]));
    });

    it("names an export without clashing with a file the app did not write", () => {
        const taken = new Set(["master-cv.html", "master-cv-2.html"]);
        expect(exportFileName("master-cv", "html", taken)).toBe("master-cv-3.html");
        expect(exportFileName("Master CV", "docx", taken)).toBe("Master-CV.docx");
        expect(exportFileName("../../x", "md", new Set())).toBe("x.md");
        expect(exportFileName("", "txt", new Set())).toBe("export.txt");
    });

    it("answers in a fixed shape", () => {
        expect(success("a", "exports/x.html", 12, 0)).toEqual({ id: "a", ok: true, file: "exports/x.html", bytes: 12, at: "1970-01-01T00:00:00.000Z" });
        expect(failure("a", "unknown-document", "Unknown target", 0)).toMatchObject({ ok: false, error: { code: "unknown-document" } });
    });

    it("removes request files after a day and keeps the newest 200 results", () => {
        const now = 10 * REQUEST_KEEP_MS;
        const results = Array.from({ length: RESULTS_CAP + 3 }, (_, index) => ({ name: `r${index}.result.json`, lastModified: now - index }));
        const plan = cleanupPlan([{ name: "old.request.json", lastModified: now - REQUEST_KEEP_MS - 1 }, { name: "new.request.json", lastModified: now - 5 }], results, now);
        expect(plan.requests).toEqual(["old.request.json"]);
        expect(plan.results).toEqual([`r${RESULTS_CAP}.result.json`, `r${RESULTS_CAP + 1}.result.json`, `r${RESULTS_CAP + 2}.result.json`]);
    });
});

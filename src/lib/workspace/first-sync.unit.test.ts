import { describe, expect, it } from "vitest";
import { hashText } from "@/lib/linked-file/hash";
import { planFirstSync, type AppDocumentInfo, type FolderFileInfo } from "./first-sync";

const doc = (id: string, over: Partial<AppDocumentInfo> = {}): AppDocumentInfo => ({ id, kind: "cv", title: `CV ${id}`, fileName: `cv-${id}.cv.json`, text: `app-${id}`, lastHash: null, ...over });
const file = (fileName: string, id: string | null, text: string | null = "x", kind: "cv" | "letter" = "cv"): FolderFileInfo => ({ kind, fileName, text, id });
const sameWhen = (equal: (doc: AppDocumentInfo, text: string) => boolean | null) => equal;

describe("first sync planning", () => {
    it("writes documents that are only in the app, defaulting to keep", () => {
        const plan = planFirstSync({ appDocs: [doc("1")], folderFiles: [], sameContent: () => true });
        expect(plan).toEqual([expect.objectContaining({ class: "only-in-app", choice: "keep-app", docId: "1", fileName: null })]);
    });

    it("recognises matching documents by id and needs no action for the same content", () => {
        const plan = planFirstSync({ appDocs: [doc("1")], folderFiles: [file("renamed.cv.json", "1")], sameContent: () => true });
        expect(plan[0]).toMatchObject({ class: "same", choice: "skip", choices: ["skip"], fileName: "renamed.cv.json" });
    });

    it("matches a file with no id by its expected name", () => {
        const plan = planFirstSync({ appDocs: [doc("1")], folderFiles: [file("CV-1.cv.json", null)], sameContent: () => false });
        expect(plan).toHaveLength(1);
        expect(plan[0]).toMatchObject({ class: "differs", docId: "1" });
    });

    it("defaults every differing document to keeping the app's version and offers the file", () => {
        const plan = planFirstSync({ appDocs: [doc("1")], folderFiles: [file("a.cv.json", "1")], sameContent: () => false });
        expect(plan[0]).toMatchObject({ class: "differs", choice: "keep-app", choices: ["keep-app", "use-file", "skip"] });
    });

    it("says which side moved when a previous sync hash is known", () => {
        const fileText = "file-version";
        const appText = "app-version";
        const base = { appDocs: [doc("1", { text: appText })], sameContent: () => false as boolean | null };
        const appNewer = planFirstSync({ ...base, appDocs: [doc("1", { text: appText, lastHash: hashText(fileText) })], folderFiles: [file("a.cv.json", "1", fileText)] });
        const fileNewer = planFirstSync({ ...base, appDocs: [doc("1", { text: appText, lastHash: hashText(appText) })], folderFiles: [file("a.cv.json", "1", fileText)] });
        expect(appNewer[0].class).toBe("app-newer");
        expect(fileNewer[0].class).toBe("file-newer");
        expect(fileNewer[0].choice).toBe("keep-app"); // still keep the app unless told otherwise
    });

    it("never imports an unfamiliar file unless ticked, and lists it", () => {
        const plan = planFirstSync({ appDocs: [], folderFiles: [file("mystery.cv.json", "zzz"), file("plain.letter.json", null, "x", "letter")], sameContent: () => true });
        expect(plan.map((item) => [item.class, item.choice, item.choices])).toEqual([
            ["only-in-folder", "skip", ["skip", "import"]],
            ["only-in-folder", "skip", ["skip", "import"]],
        ]);
    });

    it("shows two files claiming one document as conflicts and applies neither", () => {
        const plan = planFirstSync({ appDocs: [doc("1")], folderFiles: [file("a.cv.json", "1"), file("b.cv.json", "1")], sameContent: () => false });
        expect(plan.map((item) => [item.class, item.choice])).toEqual([["conflict", "skip"], ["conflict", "skip"]]);
        expect(plan.map((item) => item.fileName).sort()).toEqual(["a.cv.json", "b.cv.json"]);
    });

    it("cannot offer to use a file that could not be read or parsed", () => {
        const unreadable = planFirstSync({ appDocs: [doc("1")], folderFiles: [file("a.cv.json", "1", null)], sameContent: () => true });
        expect(unreadable[0].choices).toEqual(["keep-app", "skip"]);
        const invalid = planFirstSync({ appDocs: [doc("1")], folderFiles: [file("a.cv.json", "1", "{ cut")], sameContent: sameWhen(() => null) });
        expect(invalid[0].choices).toEqual(["keep-app", "skip"]);
    });

    it("re-setup of a folder this app wrote needs no action", () => {
        const docs = [doc("1"), doc("2"), doc("3", { kind: "letter", fileName: "l.letter.json" })];
        const files = [file("cv-1.cv.json", "1"), file("cv-2.cv.json", "2"), file("l.letter.json", "3", "x", "letter")];
        const plan = planFirstSync({ appDocs: docs, folderFiles: files, sameContent: () => true });
        expect(plan.every((item) => item.class === "same" && item.choice === "skip")).toBe(true);
    });
});

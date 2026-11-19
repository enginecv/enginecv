import { describe, expect, it } from "vitest";
import { LETTER_FORMAT, MIGRATIONS, checkFormat, migrate, parseFormat } from "./format-version";

const letter = parseFormat(LETTER_FORMAT)!;

describe("format versions", () => {
    it("parses family and major", () => {
        expect(parseFormat("enginecv.letter/v1")).toEqual({ family: "enginecv.letter", major: 1 });
        expect(parseFormat("EngineCV.Letter/v12.3")).toEqual({ family: "enginecv.letter", major: 12 });
        expect(parseFormat("nonsense")).toBeNull();
        expect(parseFormat(3)).toBeNull();
    });

    it("accepts the current version and a missing format", () => {
        expect(checkFormat("enginecv.letter/v1", letter)).toEqual({ ok: true, major: 1, migrate: false });
        expect(checkFormat(undefined, letter)).toEqual({ ok: true, major: 1, migrate: false });
    });

    it("makes a newer major read-only with the newer-version reason", () => {
        expect(checkFormat("enginecv.letter/v2", letter)).toEqual({ ok: false, reason: { code: "newer-version", detail: "v2" } });
    });

    it("says an older major needs migrating", () => {
        expect(checkFormat("enginecv.letter/v1", { family: "enginecv.letter", major: 2 })).toEqual({ ok: true, major: 1, migrate: true });
    });

    it("rejects another kind of file", () => {
        expect(checkFormat("enginecv.authoring/v1", letter)).toMatchObject({ ok: false, reason: { code: "no-document" } });
        expect(checkFormat("garbage", letter)).toMatchObject({ ok: false });
    });

    it("runs migrations in order, and none exist yet", () => {
        expect(MIGRATIONS).toEqual({});
        const document = { a: 1 };
        expect(migrate(document, "enginecv.letter", 1, 1)).toBe(document);
        MIGRATIONS.test = [(doc) => ({ ...doc, step2: true }), (doc) => ({ ...doc, step3: true })];
        expect(migrate({}, "test", 1, 3)).toEqual({ step2: true, step3: true });
        delete MIGRATIONS.test;
    });
});

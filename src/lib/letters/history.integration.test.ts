import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { makeLetter, makeSentLetter } from "../../../test/setup/letter-fixtures";
import { MAX_LETTER_HISTORY, letterFromHistory, loadLetterHistory, recordLetterHistory } from "./history";

describe("letter history", () => {
    beforeEach(async () => {
        await db.letterHistory.clear();
    });

    it("records restore points newest first and skips an unchanged state", async () => {
        const letter = makeLetter({ id: "l-1", company: "One" });
        const first = await recordLetterHistory(letter, "manual", 1000);
        const same = await recordLetterHistory(letter, "manual", 2000);
        expect(same).toBe(first);
        await recordLetterHistory({ ...letter, company: "Two" }, "manual", 3000);
        const entries = await loadLetterHistory("l-1");
        expect(entries.map((entry) => entry.letter.company)).toEqual(["Two", "One"]);
    });

    it("merges a burst of file updates into the earliest state", async () => {
        const letter = makeLetter({ id: "l-1", company: "Before" });
        await recordLetterHistory(letter, "file-sync", 1000);
        await recordLetterHistory({ ...letter, company: "Mid" }, "file-sync", 20_000);
        await recordLetterHistory({ ...letter, company: "After" }, "file-sync", 90_000);
        expect((await loadLetterHistory("l-1")).map((entry) => entry.letter.company)).toEqual(["After", "Before"]);
    });

    it("never stores the frozen snapshot", async () => {
        await recordLetterHistory(makeSentLetter({ id: "s1", cvId: null }), "manual", 1);
        expect((await loadLetterHistory("s1"))[0].letter.frozen).toBeNull();
    });

    it("restores text onto the stored letter while keeping its snapshot and status", async () => {
        const sent = makeSentLetter({ id: "s1", cvId: null, company: "Old" });
        await recordLetterHistory(sent, "manual", 1);
        const entry = (await loadLetterHistory("s1"))[0];
        const restored = letterFromHistory(entry, { ...sent, company: "Newer" });
        expect(restored?.company).toBe("Old");
        expect(restored?.frozen).toEqual(sent.frozen);
        expect(restored?.status).toBe("sent");
    });

    it("keeps at most the cap per letter, oldest dropped", async () => {
        const letter = makeLetter({ id: "l-1" });
        for (let i = 0; i < MAX_LETTER_HISTORY + 5; i++) await recordLetterHistory({ ...letter, company: `v${i}` }, "manual", 1000 + i);
        const entries = await loadLetterHistory("l-1");
        expect(entries).toHaveLength(MAX_LETTER_HISTORY);
        expect(entries[0].letter.company).toBe(`v${MAX_LETTER_HISTORY + 4}`);
    }, 30_000);
});

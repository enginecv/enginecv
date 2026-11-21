import { describe, expect, it } from "vitest";
import { authoringToResume, parseAuthoringText } from "@/lib/agent/authoring";
import { createQaFullResume } from "@/lib/qa/sample-resumes";
import type { Resume } from "@/lib/schema";
import { HIDDEN_BASICS_KEYS, createCvCodec } from "./cv";

const codec = createCvCodec();
const options = { hideContact: false };

function withContact(resume: Resume): Resume {
    return { ...resume, id: "cv-1", basics: { ...resume.basics, name: "Amina Hodzic", email: "amina@example.com", phone: "+49 30 1234567", location: "Berlin, Germany", dateOfBirth: "1990-01-02" } };
}

describe("CV codec", () => {
    it("round-trips a CV through its file text and writes the document id near the top", () => {
        const resume = withContact(createQaFullResume());
        const text = codec.serialize(resume, options);
        expect(text.endsWith("\n")).toBe(true);
        expect(JSON.parse(text).id).toBe("cv-1");
        expect(text.indexOf('"id"')).toBeLessThan(text.indexOf('"basics"'));

        const parsed = codec.parse(text, { now: 1, hideContact: false });
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.id).toBe("cv-1");
        expect(codec.entryCount(parsed.doc)).toBe(codec.entryCount(resume));
        expect(parsed.doc.basics.name).toBe("Amina Hodzic");
        expect(parsed.doc.basics.dateOfBirth).toBe("1990-01-02");
    });

    it("leaves the id out for the per-CV link", () => {
        const text = createCvCodec({ includeId: false }).serialize(withContact(createQaFullResume()), options);
        expect(JSON.parse(text).id).toBeUndefined();
    });

    it("does not turn the id into a custom section when a file is read", () => {
        const resume = withContact(createQaFullResume());
        const parsed = codec.parse(codec.serialize(resume, options), { now: 1, hideContact: false });
        expect(parsed.ok && parsed.doc.customSections.map((section) => section.title)).toEqual(resume.customSections.map((section) => section.title));
    });

    it("blocks bad files with a reason and applies nothing", () => {
        expect(codec.parse("", { now: 1, hideContact: false })).toMatchObject({ ok: false, reason: { code: "empty" } });
        expect(codec.parse("{ not json", { now: 1, hideContact: false })).toMatchObject({ ok: false, reason: { code: "invalid-json" } });
        expect(codec.parse("{}", { now: 1, hideContact: false })).toMatchObject({ ok: false, reason: { code: "no-document" } });
        expect(codec.parse(JSON.stringify({ format: "enginecv.authoring/v1" }), { now: 1, hideContact: false })).toMatchObject({ ok: false, reason: { code: "no-document" } });
    });

    it("keeps design, photo and signature when a file is applied", () => {
        const current = { ...withContact(createQaFullResume()), settings: { ...createQaFullResume().settings } };
        current.basics = { ...current.basics, photo: "data:image/png;base64,AAAA" };
        const text = JSON.stringify({ ...JSON.parse(codec.serialize(current, options)), basics: { name: "Changed Name" } });
        const parsed = codec.parse(text, { now: 1, hideContact: false });
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        const next = codec.apply(current, parsed.doc, options);
        expect(next.basics.name).toBe("Changed Name");
        expect(next.basics.photo).toBe("data:image/png;base64,AAAA");
        expect(next.settings.typography).toEqual(current.settings.typography);
    });

    describe("leave contact details out", () => {
        const hide = { hideContact: true };

        it("omits contact and personal fields from the text and keeps the rest", () => {
            const file = JSON.parse(codec.serialize(withContact(createQaFullResume()), hide));
            for (const key of ["email", "phone", "location", "dateOfBirth", "website", "linkedin", "github", "links"]) expect(file.basics[key], key).toBeUndefined();
            expect(file.basics.name).toBe("Amina Hodzic");
            expect(JSON.stringify(file)).not.toContain("amina@example.com");
            expect(JSON.stringify(file)).not.toContain("+49 30 1234567");
        });

        it("ignores contact fields a file adds, keeps the app's values and says so", () => {
            const current = withContact(createQaFullResume());
            const file = JSON.parse(codec.serialize(current, hide));
            file.basics.email = "agent@evil.example";
            file.basics.phone = "000";
            file.basics.name = "New Name";
            const parsed = codec.parse(JSON.stringify(file), { now: 1, hideContact: true });
            expect(parsed.ok).toBe(true);
            if (!parsed.ok) return;
            expect(parsed.notices.map((notice) => notice.code)).toContain("contact-ignored");
            const next = codec.apply(current, parsed.doc, hide);
            expect(next.basics.name).toBe("New Name");
            for (const key of HIDDEN_BASICS_KEYS) expect(next.basics[key as keyof typeof next.basics], key).toEqual(current.basics[key as keyof typeof current.basics]);
            expect(next.basics.email).toBe("amina@example.com");
        });

        it("raises no notice when the file has no contact fields", () => {
            const parsed = codec.parse(codec.serialize(withContact(createQaFullResume()), hide), { now: 1, hideContact: true });
            expect(parsed.ok && parsed.notices.map((notice) => notice.code)).not.toContain("contact-ignored");
        });
    });

    it("describes changes and compares content", () => {
        const a = withContact(createQaFullResume());
        const b = { ...a, basics: { ...a.basics, headline: "Different" } };
        expect(codec.isSameContent(a, a)).toBe(true);
        expect(codec.isSameContent(a, b)).toBe(false);
        expect(codec.describeChange(a, a)).toEqual({ added: 0, removed: 0, changed: 0 });
        expect(codec.canApplyExternal(a)).toEqual({ ok: true });
        expect(codec.updatedAt(a)).toBe(a.updatedAt);
        expect(authoringToResume(JSON.parse(codec.serialize(a, options))).resume.basics.name).toBe("Amina Hodzic");
        expect(parseAuthoringText(codec.serialize(a, options)).status).toBe("ok");
    });
});

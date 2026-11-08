import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { resumeSchema } from "../schema";
import { getBuiltinTemplates } from "./enginecv-templates";
import { templateDocumentSchema } from "./template-schema";
import { createResumeFromTemplate } from "./use-template";

describe("createResumeFromTemplate", () => {
    beforeEach(async () => {
        await db.resumes.clear();
        await db.resumeHistory.clear();
        await db.templates.clear();
    });

    afterEach(async () => {
        await db.resumes.clear();
        await db.resumeHistory.clear();
        await db.templates.clear();
    });

    it("creates and validates a new resume from a builtin template", async () => {
        const template = getBuiltinTemplates()[0];

        const id = await createResumeFromTemplate(template.id);
        const persisted = await db.resumes.get(id);

        expect(persisted).toBeDefined();
        expect(() => resumeSchema.parse(persisted)).not.toThrow();
        expect(persisted?.settings.theme).toBe(template.settings.theme);
        expect(persisted?.settings.colors).toEqual(template.settings.colors);
        expect(persisted?.settings.typography).toEqual(template.settings.typography);
        expect(await db.resumeHistory.where("resumeId").equals(id).count()).toBe(1);
    });

    it("creates a new resume from a user template stored in Dexie", async () => {
        const builtin = getBuiltinTemplates()[1];
        const userTemplate = templateDocumentSchema.parse({
            ...builtin,
            id: "user-template-test",
            meta: {
                ...builtin.meta,
                source: "user",
            },
        });
        await db.templates.add(userTemplate);

        const id = await createResumeFromTemplate(userTemplate.id);
        const persisted = await db.resumes.get(id);

        expect(id).not.toBe(userTemplate.id);
        expect(persisted?.settings.design).toEqual(userTemplate.settings.design);
        expect(persisted?.settings.layout).toEqual(userTemplate.settings.layout);
        expect(() => resumeSchema.parse(persisted)).not.toThrow();
    });

    it("rejects an unknown template without persisting a resume", async () => {
        await expect(createResumeFromTemplate("missing-template")).rejects.toThrow(
            'Template "missing-template" not found.',
        );

        expect(await db.resumes.count()).toBe(0);
        expect(await db.resumeHistory.count()).toBe(0);
    });
});

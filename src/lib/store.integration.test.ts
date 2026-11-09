import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyResume } from "./schema";
import { db } from "./db";
import { useResumeStore } from "./store";
import { getBuiltinTemplateById } from "./templates/enginecv-templates";

type ResumeStoreState = ReturnType<typeof useResumeStore.getState>;

function createResetState(): Partial<ResumeStoreState> {
    return {
        activeResumeId: null,
        resume: createEmptyResume(),
        isSaving: false,
        isDirty: false,
        lastSavedAt: null,
        paperSize: "a4",
        aiProposals: [],
        aiChatMode: "auto",
        sidebarTab: "content",
        selectedDesignElementId: null,
        activeDesignPage: 0,
        previewPageCount: 1,
        documentMode: "resume",
        activeTemplateId: null,
        templateMeta: null,
        isTemplateReadOnly: false,
        resumeSnapshotBeforeTemplate: null,
        autoSaveEnabled: true,
        persistenceSuspended: false,
    };
}

function resetStore(overrides: Partial<ResumeStoreState> = {}) {
    useResumeStore.setState({
        ...createResetState(),
        ...overrides,
    });
}

function createResumeWithLanguage(language: string) {
    const resume = createEmptyResume();
    resume.settings.language = language;
    return resume;
}

function expectResumeEditorSession(id: string) {
    const state = useResumeStore.getState();

    expect(state.activeResumeId).toBe(id);
    expect(state.resume.id).toBe(id);
    expect(state.sidebarTab).toBe("content");
    expect(state.selectedDesignElementId).toBeNull();
    expect(state.activeDesignPage).toBe(0);
    expect(state.previewPageCount).toBe(1);
    expect(state.documentMode).toBe("resume");
    expect(state.activeTemplateId).toBeNull();
    expect(state.templateMeta).toBeNull();
    expect(state.isTemplateReadOnly).toBe(false);
    expect(state.resumeSnapshotBeforeTemplate).toBeNull();
    expect(state.aiProposals).toHaveLength(0);
    expect(state.isDirty).toBe(false);
    expect(state.lastSavedAt).toBe(state.resume.updatedAt);

    return state;
}

describe("useResumeStore", () => {
    beforeEach(async () => {
        await db.resumes.clear();
        resetStore();
    });

    afterEach(async () => {
        await db.resumes.clear();
        resetStore();
    });

    it("deep merges nested settings updates without dropping siblings", () => {
        const { colors } = useResumeStore.getState().resume.settings;

        useResumeStore.getState().updateSettings({
            measurementSystem: "imperial",
            colors: {
                ...colors,
                accent: "#123456",
            },
        });

        const state = useResumeStore.getState();

        expect(state.isDirty).toBe(true);
        expect(state.resume.settings.measurementSystem).toBe("imperial");
        expect(state.resume.settings.colors.accent).toBe("#123456");
        expect(state.resume.settings.colors.text).toBe("#111827");
        expect(state.resume.settings.colors.background).toBe("#fff8f6");
    });

    it("stores labeled emails and keeps the legacy primary email synchronized", () => {
        useResumeStore.getState().updateBasics({
            emails: [
                { id: "email-main", email: "main@example.com", label: "Primary" },
                { id: "email-personal", email: "personal@example.com", label: "Personal" },
            ],
        });

        let basics = useResumeStore.getState().resume.basics;
        expect(basics.email).toBe("main@example.com");
        expect(basics.emails).toHaveLength(2);

        useResumeStore.getState().updateBasics({ email: "updated@example.com" });

        basics = useResumeStore.getState().resume.basics;
        expect(basics.email).toBe("updated@example.com");
        expect(basics.emails).toEqual([
            { id: "email-main", email: "updated@example.com", label: "Primary" },
            { id: "email-personal", email: "personal@example.com", label: "Personal" },
        ]);
    });

    it("starts new blank resumes with a fresh content-first editor session", async () => {
        const templatePreviewResume = createResumeWithLanguage("de");

        resetStore({
            activeResumeId: "template-preview",
            resume: templatePreviewResume,
            isDirty: true,
            lastSavedAt: 1234,
            paperSize: "letter",
            aiProposals: [{ id: "proposal-1", path: "basics.name", next: "AI Jane" }],
            sidebarTab: "customize",
            selectedDesignElementId: "element-1",
            activeDesignPage: 3,
            previewPageCount: 5,
            documentMode: "template",
            activeTemplateId: "template-1",
            templateMeta: {
                name: "Template starter",
                description: "",
                tags: [],
                source: "user",
            },
            isTemplateReadOnly: true,
            resumeSnapshotBeforeTemplate: {
                resume: templatePreviewResume,
                activeResumeId: "template-preview",
                paperSize: "letter",
            },
        });

        const id = await useResumeStore.getState().createNew();
        const state = expectResumeEditorSession(id);

        expect(state.resume.settings.language).toBe("en");
        expect(state.paperSize).toBe("letter");
    });

    it("starts a new blank resume from the Modern template design", async () => {
        const modern = getBuiltinTemplateById("enginecv-modern");
        expect(modern).toBeDefined();

        const id = await useResumeStore.getState().createNew();
        const { resume } = expectResumeEditorSession(id);

        expect(resume.settings.colors.accent).toBe(modern?.settings.colors.accent);
        expect(resume.settings.colors.accent).not.toBe(createEmptyResume().settings.colors.accent);
    });

    it("creates, saves, and reloads a resume through IndexedDB", async () => {
        const id = await useResumeStore.getState().createNew();

        useResumeStore.getState().updateBasics({
            name: "Alicia Vector",
            headline: "Platform Engineer",
        });
        useResumeStore.getState().updateMeta({
            title: "Alicia Vector Platform Resume",
            description: "Resume tailored for platform engineering roles.",
        });
        await useResumeStore.getState().saveToDb();

        const persisted = await db.resumes.get(id);
        expect(persisted?.basics.name).toBe("Alicia Vector");
        expect(persisted?.meta.title).toBe("Alicia Vector Platform Resume");
        expect(typeof persisted?.createdAt).toBe("number");

        resetStore();
        await useResumeStore.getState().loadFromDb(id);

        const reloaded = useResumeStore.getState();
        expect(reloaded.activeResumeId).toBe(id);
        expect(reloaded.resume.id).toBe(id);
        expect(reloaded.resume.basics.name).toBe("Alicia Vector");
        expect(reloaded.resume.basics.headline).toBe("Platform Engineer");
        expect(reloaded.resume.meta.title).toBe("Alicia Vector Platform Resume");
        expect(reloaded.resume.meta.description).toBe("Resume tailored for platform engineering roles.");
        expect(typeof reloaded.resume.createdAt).toBe("number");
        expect(reloaded.isDirty).toBe(false);
        expect(reloaded.lastSavedAt).not.toBeNull();
    });

    it("saves nothing once persistence is suspended for data deletion", async () => {
        const id = await useResumeStore.getState().createNew();
        useResumeStore.getState().updateBasics({ name: "Before" });
        await useResumeStore.getState().saveToDb();

        useResumeStore.getState().suspendPersistence();
        useResumeStore.getState().updateBasics({ name: "After" });
        await useResumeStore.getState().saveToDb("manual");

        expect((await db.resumes.get(id))?.basics.name).toBe("Before");
        expect(useResumeStore.getState().autoSaveEnabled).toBe(false);
    });

    it("loads existing resumes with a fresh content-first editor session", async () => {
        const persistedResume = createResumeWithLanguage("de");
        persistedResume.id = "persisted-resume";
        persistedResume.basics.name = "Existing Resume";
        persistedResume.updatedAt = Date.now();
        persistedResume.createdAt = persistedResume.updatedAt - 1000;

        await db.resumes.add(persistedResume);

        resetStore({
            activeResumeId: "stale-resume",
            resume: createResumeWithLanguage("fr"),
            isDirty: true,
            lastSavedAt: 2222,
            aiProposals: [{ id: "proposal-4", path: "basics.name", next: "Stale" }],
            sidebarTab: "customize",
            selectedDesignElementId: "element-4",
            activeDesignPage: 4,
            previewPageCount: 6,
            documentMode: "template",
            activeTemplateId: "template-4",
            templateMeta: {
                name: "Stale template",
                description: "",
                tags: [],
                source: "user",
            },
            isTemplateReadOnly: true,
            resumeSnapshotBeforeTemplate: {
                resume: createResumeWithLanguage("fr"),
                activeResumeId: "stale-resume",
                paperSize: "letter",
            },
        });

        await useResumeStore.getState().loadFromDb(persistedResume.id);
        const state = expectResumeEditorSession(persistedResume.id);

        expect(state.resume.basics.name).toBe("Existing Resume");
        expect(state.resume.settings.language).toBe("de");
    });

    it("does not leak customize state into repeated same-session new resume creation", async () => {
        const firstId = await useResumeStore.getState().createNew();

        useResumeStore.setState({
            isDirty: true,
            aiProposals: [{ id: "proposal-2", path: "basics.headline", next: "Staff Engineer" }],
            sidebarTab: "customize",
            selectedDesignElementId: "element-2",
            activeDesignPage: 2,
            previewPageCount: 4,
        });

        const secondId = await useResumeStore.getState().createNew();
        const state = expectResumeEditorSession(secondId);

        expect(secondId).not.toBe(firstId);
        expect(state.resume.createdAt).toBe(state.resume.updatedAt);
    });

    it("keeps the new-resume content default independent of the previous resume language", async () => {
        resetStore({
            activeResumeId: "german-resume",
            resume: createResumeWithLanguage("de"),
            sidebarTab: "customize",
            selectedDesignElementId: "element-3",
            activeDesignPage: 1,
            previewPageCount: 2,
        });

        const id = await useResumeStore.getState().createNew();
        const state = expectResumeEditorSession(id);

        expect(state.resume.settings.language).toBe("en");
    });

    it("queues and applies AI leaf patch proposals", () => {
        const currentResume = useResumeStore.getState().resume;
        const queued = useResumeStore.getState().queueAIPatchProposals({
            basics: {
                ...currentResume.basics,
                name: "AI Jane",
            },
            settings: {
                ...currentResume.settings,
                colors: {
                    ...currentResume.settings.colors,
                    accent: "#000000",
                },
            },
        });

        expect(queued).toBe(2);
        const proposals = useResumeStore.getState().aiProposals;
        const nameProposal = proposals.find((proposal) => proposal.path === "basics.name");
        const accentProposal = proposals.find((proposal) => proposal.path === "settings.colors.accent");

        expect(nameProposal).toBeDefined();
        expect(accentProposal).toBeDefined();

        useResumeStore.getState().acceptAIProposal(nameProposal!.id);
        useResumeStore.getState().acceptAIProposal(accentProposal!.id);

        const state = useResumeStore.getState();
        expect(state.resume.basics.name).toBe("AI Jane");
        expect(state.resume.settings.colors.accent).toBe("#000000");
        expect(state.aiProposals).toHaveLength(0);
    });

    it("creates, duplicates, reorders, and persists design overlay elements", async () => {
        const id = await useResumeStore.getState().createNew();

        const textId = useResumeStore.getState().addDesignElement("text", 0);
        useResumeStore.getState().updateDesignElement(textId, {
            text: "Overlay headline",
            x: 96,
            y: 108,
        });
        useResumeStore.getState().updateDesignElementStyle(textId, {
            fontSize: 28,
            opacity: 82,
        });

        const shapeId = useResumeStore.getState().addDesignElement("shape", 0);
        useResumeStore.getState().moveDesignElementLayer(shapeId, "back");
        useResumeStore.getState().duplicateDesignElement(textId);

        await useResumeStore.getState().saveToDb();

        const persisted = await db.resumes.get(id);
        expect(persisted?.settings.design.elements).toHaveLength(3);

        resetStore();
        await useResumeStore.getState().loadFromDb(id);

        const reloaded = useResumeStore.getState().resume.settings.design.elements;
        expect(reloaded).toHaveLength(3);
        expect(reloaded.some((element) => element.id === textId && element.text === "Overlay headline")).toBe(true);
        expect(reloaded.some((element) => element.type === "shape")).toBe(true);
        expect(reloaded.filter((element) => element.type === "text")).toHaveLength(2);
    });

    it("removes selected design overlay elements and clears the selection", async () => {
        const id = await useResumeStore.getState().createNew();

        const textId = useResumeStore.getState().addDesignElement("text", 0);
        const shapeId = useResumeStore.getState().addDesignElement("shape", 0);
        useResumeStore.getState().selectDesignElement(textId);

        useResumeStore.getState().removeDesignElement(textId);
        await useResumeStore.getState().saveToDb();

        const state = useResumeStore.getState();
        expect(state.selectedDesignElementId).toBeNull();
        expect(state.resume.settings.design.elements.map((element) => element.id)).toEqual([shapeId]);

        const persisted = await db.resumes.get(id);
        expect(persisted?.settings.design.elements).toHaveLength(1);
        expect(persisted?.settings.design.elements[0]?.id).toBe(shapeId);
    });
});

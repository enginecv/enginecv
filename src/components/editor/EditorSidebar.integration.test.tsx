import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyCefrSkillLevels } from "@/lib/cefr";
import { createEmptyResume } from "@/lib/schema";
import { useI18nStore } from "@/lib/i18n";
import { useResumeStore } from "@/lib/store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorSidebar, hasContentSection } from "./EditorSidebar";

function resetStore() {
    useI18nStore.setState({ locale: "en", _hydrated: true });
    useResumeStore.setState({
        activeResumeId: null,
        resume: createEmptyResume(),
        isSaving: false,
        isDirty: false,
        lastSavedAt: null,
        paperSize: "a4",
        aiProposals: [],
        aiChatMode: "auto",
        sidebarTab: "content",
        customizeScope: "resume",
        pendingEditorNav: null,
        pendingContentNav: null,
        pendingCustomizeNav: null,
        selectedCustomizeSection: null,
        selectedDesignElementId: null,
        activeDesignPage: 0,
        previewPageCount: 1,
        documentMode: "resume",
        activeTemplateId: null,
        templateMeta: null,
        isTemplateReadOnly: false,
        resumeSnapshotBeforeTemplate: null,
    });
}

function seedSkillsResume() {
    const resume = createEmptyResume();
    resume.settings.contentSections = ["skills", "projects"];
    resume.skillGroups = [{
        id: "ungrouped",
        name: "",
        hidden: false,
        skills: [
            { id: "s1", hidden: false, name: "TypeScript", description: "", level: "expert", icon: "auto", display: "name" as const, keywords: [] },
            { id: "s2", hidden: false, name: "Go", description: "", level: "competent", icon: "auto", display: "name" as const, keywords: [] },
            { id: "s3", hidden: false, name: "Rust", description: "", level: "", icon: "auto", display: "name" as const, keywords: [] },
        ],
    }];
    useResumeStore.setState({ resume });
    return resume;
}

describe("EditorSidebar entry counts and visibility", () => {
    beforeEach(() => {
        class MockWorker {
            addEventListener() { /* no-op */ }
            removeEventListener() { /* no-op */ }
            postMessage() { /* no-op */ }
        }
        vi.stubGlobal("Worker", MockWorker);
        resetStore();
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it("edits multiple emails with user-defined labels in personal information", async () => {
        const user = userEvent.setup();

        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        await user.click(screen.getByTestId("sidebar-basics-card"));
        fireEvent.change(screen.getByTestId("email-address-0"), { target: { value: "main@example.com" } });
        fireEvent.change(screen.getByTestId("email-label-0"), { target: { value: "Primary" } });
        await user.click(screen.getByTestId("add-email"));
        fireEvent.change(screen.getByTestId("email-address-1"), { target: { value: "personal@example.com" } });
        fireEvent.change(screen.getByTestId("email-label-1"), { target: { value: "Personal" } });

        const basics = useResumeStore.getState().resume.basics;
        expect(basics.email).toBe("main@example.com");
        expect(basics.emails).toEqual([
            expect.objectContaining({ email: "main@example.com", label: "Primary" }),
            expect.objectContaining({ email: "personal@example.com", label: "Personal" }),
        ]);

        await user.click(screen.getByTestId("move-email-up-1"));

        const reorderedBasics = useResumeStore.getState().resume.basics;
        expect(reorderedBasics.email).toBe("personal@example.com");
        expect(reorderedBasics.emails.map((entry) => entry.email)).toEqual([
            "personal@example.com",
            "main@example.com",
        ]);
    }, 10_000);

    it("shows live entry-count badges on section cards", async () => {
        const user = userEvent.setup();
        seedSkillsResume();

        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        expect(screen.getByTestId("section-count-skills")).toHaveTextContent("3");
        expect(screen.getByTestId("section-count-projects")).toHaveTextContent("0");

        // still present when the card is expanded
        await user.click(screen.getByTestId("section-expand-skills"));
        expect(screen.getByTestId("section-count-skills")).toHaveTextContent("3");

        // removing an entry updates the badge
        act(() => {
            const resume = useResumeStore.getState().resume;
            useResumeStore.setState({
                resume: {
                    ...resume,
                    skillGroups: [{ ...resume.skillGroups[0], skills: resume.skillGroups[0].skills.slice(0, 2) }],
                },
            });
        });
        expect(screen.getByTestId("section-count-skills")).toHaveTextContent("2");
    });

    it("counts hidden entries in the badge total with a hidden annotation", () => {
        const resume = seedSkillsResume();
        resume.skillGroups[0].skills[1].hidden = true;
        useResumeStore.setState({ resume: { ...resume } });

        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        expect(screen.getByTestId("section-count-skills")).toHaveTextContent("3");
        expect(screen.getByTestId("section-hidden-count-skills")).toBeInTheDocument();
    });

    it("toggles section visibility via the eye button without collapsing the card", async () => {
        const user = userEvent.setup();
        seedSkillsResume();

        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        const toggle = screen.getByTestId("section-visibility-skills");
        expect(toggle).toHaveAttribute("aria-label", expect.stringContaining("Hide"));

        await user.click(toggle);

        expect(useResumeStore.getState().resume.settings.hiddenSections).toEqual(["skills"]);
        expect(screen.getByTestId("section-visibility-skills")).toHaveAttribute(
            "aria-label",
            expect.stringContaining("Show"),
        );
        expect(screen.getByTestId("section-card-skills").className).toMatch(/opacity/);

        await user.click(screen.getByTestId("section-visibility-skills"));
        expect(useResumeStore.getState().resume.settings.hiddenSections).toEqual([]);
    });

    it("announces the section toggle in the active locale", async () => {
        const { useI18nStore } = await import("@/lib/i18n");
        useI18nStore.setState({ locale: "bs", _hydrated: true });
        seedSkillsResume();

        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        expect(screen.getByTestId("section-visibility-skills")).toHaveAttribute(
            "aria-label",
            expect.stringContaining("Sakrij"),
        );

        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    it("toggles individual entry visibility and dims the row", async () => {
        const user = userEvent.setup();
        seedSkillsResume();

        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        // expand the skills card to reveal entry rows
        await user.click(screen.getByTestId("section-expand-skills"));

        const entryToggle = screen.getByTestId("entry-visibility-skills-1");
        await user.click(entryToggle);

        const skills = useResumeStore.getState().resume.skillGroups[0].skills;
        expect(skills[1].hidden).toBe(true);
        expect(skills[0].hidden).toBe(false);
        expect(screen.getByTestId("entry-row-skills-1").className).toMatch(/opacity/);

        await user.click(screen.getByTestId("entry-visibility-skills-1"));
        expect(useResumeStore.getState().resume.skillGroups[0].skills[1].hidden).toBe(false);
    });

    const seedTwoEducationEntries = () => {
        const resume = createEmptyResume();
        resume.settings.contentSections = ["education"];
        resume.education = [
            { id: "e1", hidden: false, institution: "MIT", area: "CS", studyType: "BSc", start: "", end: "", location: "", description: "", score: "", courses: [], skills: [], url: "", urlIcon: "auto" },
            { id: "e2", hidden: false, institution: "Stanford", area: "EE", studyType: "MSc", start: "", end: "", location: "", description: "", score: "", courses: [], skills: [], url: "", urlIcon: "auto" },
        ];
        useResumeStore.setState({ resume });
    };

    it("deletes a single entry via the confirm dialog", async () => {
        const user = userEvent.setup();
        seedTwoEducationEntries();
        render(<TooltipProvider><EditorSidebar /></TooltipProvider>);

        await user.click(screen.getByTestId("section-expand-education"));
        await user.click(screen.getByTestId("entry-delete-education-0"));
        await user.click(screen.getByRole("button", { name: "Delete" }));

        const edu = useResumeStore.getState().resume.education;
        expect(edu).toHaveLength(1);
        expect(edu[0].institution).toBe("Stanford");
    });

    it("bulk-hides then bulk-deletes selected entries", async () => {
        const user = userEvent.setup();
        seedTwoEducationEntries();
        render(<TooltipProvider><EditorSidebar /></TooltipProvider>);

        await user.click(screen.getByTestId("section-expand-education"));
        await user.click(screen.getByTestId("entry-select-education-0"));
        await user.click(screen.getByTestId("entry-select-education-1"));

        await user.click(screen.getByTitle("Hide selected"));
        let edu = useResumeStore.getState().resume.education;
        expect(edu[0].hidden).toBe(true);
        expect(edu[1].hidden).toBe(true);

        await user.click(screen.getByTestId("bulk-delete-education"));
        await user.click(screen.getByRole("button", { name: "Delete" }));
        edu = useResumeStore.getState().resume.education;
        expect(edu).toHaveLength(0);
    });

});

describe("EditorSidebar content overview", () => {
    beforeEach(() => {
        resetStore();
        // Adding a section now lands in the entry editor, which mounts useAI.
        vi.stubGlobal("Worker", class {
            addEventListener() {}
            removeEventListener() {}
            postMessage() {}
        });
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it("shows configured sections only in the on-resume group", () => {
        const resume = createEmptyResume();
        resume.settings.contentSections = ["projects"];
        useResumeStore.setState({ resume });

        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        expect(screen.getByTestId("section-card-projects")).toBeInTheDocument();
        expect(screen.queryByTestId("add-content-projects")).not.toBeInTheDocument();
        expect(useResumeStore.getState().resume.settings.contentSections).toEqual(["projects"]);
    });

    it("keeps every section unique after adding it once", async () => {
        const user = userEvent.setup();

        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        await user.click(screen.getByTestId("add-content-courses"));

        expect(useResumeStore.getState().resume.settings.contentSections).toEqual(["courses"]);

        await user.click(screen.getByTestId("section-form-back"));
        expect(screen.queryByTestId("add-content-courses")).not.toBeInTheDocument();
        expect(screen.getByTestId("section-card-courses")).toBeInTheDocument();
        expect(hasContentSection(useResumeStore.getState().resume.settings.contentSections, "courses")).toBe(true);
    });

    it("opens a newly added section on its first entry instead of the meta editor", async () => {
        const user = userEvent.setup();

        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        await user.click(screen.getByTestId("add-content-courses"));

        expect(useResumeStore.getState().resume.courses).toHaveLength(1);
        expect(screen.getByRole("heading", { name: /Edit entry in/i })).toBeInTheDocument();
    });

    it("keeps the entries of a section that is re-added, without appending a blank one", async () => {
        const user = userEvent.setup();
        const resume = createEmptyResume();
        resume.courses = [{
            id: "course-1",
            hidden: false,
            name: "Distributed Systems",
            institution: "MIT",
            start: "",
            end: "",
            location: "",
            description: "",
            skills: [],
            url: "",
            urlIcon: "auto",
        }] as any;
        useResumeStore.setState({ resume });

        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        await user.click(screen.getByTestId("add-content-courses"));

        expect(useResumeStore.getState().resume.courses).toHaveLength(1);
        expect(screen.getByTestId("courses-meta-add-entry")).toBeInTheDocument();
    });

    it("adds an entry straight from the section meta editor", async () => {
        const user = userEvent.setup();
        const resume = createEmptyResume();
        resume.settings.contentSections = ["courses"];
        useResumeStore.setState({ resume });

        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        await user.click(screen.getByTestId("section-edit-courses"));
        await user.click(screen.getByTestId("courses-meta-add-entry"));

        expect(useResumeStore.getState().resume.courses).toHaveLength(1);
        expect(screen.getByRole("heading", { name: /Edit entry in/i })).toBeInTheDocument();
    });
});

describe("EditorSidebar language assessment", () => {
    beforeEach(() => {
        resetStore();
        vi.stubGlobal("Worker", class {
            addEventListener() {}
            removeEventListener() {}
            postMessage() {}
        });
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it("stores verification details and clears assessment when proficiency becomes Native", async () => {
        const user = userEvent.setup();
        const resume = createEmptyResume();
        resume.settings.contentSections = ["languages"];
        resume.languages = [{
            id: "language-1",
            hidden: false,
            language: "English",
            fluency: "B2",
            cefrDetailed: false,
            cefr: emptyCefrSkillLevels(),
            assessmentType: "issuer",
            issuer: "IELTS",
            assessmentId: "",
            assessmentUrl: "",
            description: "",
        }];
        useResumeStore.setState({ resume });

        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        // Expand the section, then open the single entry's editor.
        await user.click(screen.getByTestId("section-card-languages"));
        await user.click(screen.getByTestId("entry-row-languages-0"));
        await user.type(screen.getByPlaceholderText("Certificate or result number"), "TRF-12345");
        await user.type(
            screen.getByPlaceholderText("https://issuer.example/verify/..."),
            "https://ielts.org/verify/TRF-12345",
        );

        expect(useResumeStore.getState().resume.languages[0]).toMatchObject({
            assessmentType: "issuer",
            issuer: "IELTS",
            assessmentId: "TRF-12345",
            assessmentUrl: "https://ielts.org/verify/TRF-12345",
        });

        await user.click(screen.getByRole("button", { name: "Native" }));

        expect(useResumeStore.getState().resume.languages[0]).toMatchObject({
            fluency: "Native",
            assessmentType: "none",
            issuer: "",
            assessmentId: "",
            assessmentUrl: "",
        });
        expect(screen.getByText("Native proficiency does not need an assessment.")).toBeInTheDocument();
        expect(screen.queryByText("Issuing Organisation")).not.toBeInTheDocument();
    });

    it("switches a language to per-skill levels seeded from its single level", async () => {
        const user = userEvent.setup();
        const resume = createEmptyResume();
        resume.settings.contentSections = ["languages"];
        resume.languages = [{
            id: "language-1",
            hidden: false,
            language: "English",
            fluency: "B2",
            cefrDetailed: false,
            cefr: { listening: "", reading: "", spokenInteraction: "", spokenProduction: "", writing: "" },
            assessmentType: "self",
            issuer: "",
            assessmentId: "",
            assessmentUrl: "",
            description: "",
        }];
        useResumeStore.setState({ resume });

        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        await user.click(screen.getByTestId("section-card-languages"));
        await user.click(screen.getByTestId("entry-row-languages-0"));
        await user.click(screen.getByTestId("language-level-mode-detailed"));

        expect(useResumeStore.getState().resume.languages[0]).toMatchObject({
            cefrDetailed: true,
            fluency: "B2",
            cefr: { listening: "B2", reading: "B2", spokenInteraction: "B2", spokenProduction: "B2", writing: "B2" },
        });

        await user.click(screen.getByTestId("cefr-level-listening-C2"));
        await user.click(screen.getByTestId("cefr-level-reading-C2"));
        await user.click(screen.getByTestId("cefr-level-writing-C1"));
        // Median of C2, C2, B2, B2, C1 keeps the single-level layouts honest.
        expect(useResumeStore.getState().resume.languages[0]).toMatchObject({ fluency: "C1" });

        await user.click(screen.getByTestId("language-use-cefr-layout"));
        expect(useResumeStore.getState().resume.settings.sectionDisplay.languages?.languageLayout).toBe("cefr");
        expect(screen.queryByTestId("language-use-cefr-layout")).not.toBeInTheDocument();

        await user.click(screen.getByTestId("language-level-mode-simple"));
        expect(useResumeStore.getState().resume.languages[0]).toMatchObject({ cefrDetailed: false, fluency: "C1" });
        expect(screen.queryByTestId("cefr-skill-grid")).not.toBeInTheDocument();
    });
});

describe("EditorSidebar customize defaults", () => {
    beforeEach(() => {
        resetStore();
    });

    afterEach(() => {
        cleanup();
    });

    it("uses grouped command rows and opens one focused detail view", async () => {
        const user = userEvent.setup();

        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        await user.click(screen.getByTestId("sidebar-tab-customize"));

        expect(screen.getByRole("button", { name: "Whole resume" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByText("Appearance")).toBeInTheDocument();
        expect(screen.getByText("Document")).toBeInTheDocument();
        expect(screen.getByTestId("customize-row-templates")).toBeInTheDocument();
        expect(screen.getByTestId("customize-row-documentUnits")).toBeInTheDocument();
        expect(screen.queryByTestId("measurement-system-select")).not.toBeInTheDocument();

        await user.click(screen.getByTestId("customize-row-documentUnits"));

        expect(screen.getByRole("heading", { name: "Document Units" })).toBeInTheDocument();
        expect(screen.getByTestId("measurement-system-select")).toBeInTheDocument();
        expect(screen.queryByTestId("customize-row-templates")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Whole resume" }));
        expect(screen.getByTestId("customize-row-templates")).toBeInTheDocument();
    });

    it("opens an exact customization detail from a navigation request", async () => {
        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        act(() => useResumeStore.getState().requestCustomizePanel("spacing"));

        expect(await screen.findByRole("heading", { name: "Spacing" })).toBeInTheDocument();
        expect(screen.getByTestId("customize-detail-spacing")).toBeInTheDocument();
        expect(useResumeStore.getState().pendingCustomizeNav).toBeNull();
    });

    it("preserves customize scope across Content tab round trips", async () => {
        const user = userEvent.setup();
        const resume = createEmptyResume();
        resume.settings.contentSections = ["experience"];
        useResumeStore.setState({ resume });

        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        await user.click(screen.getByTestId("sidebar-tab-customize"));
        await user.click(screen.getByRole("button", { name: "Current section" }));
        await user.click(screen.getByTestId("sidebar-tab-content"));
        await user.click(screen.getByTestId("sidebar-tab-customize"));
        expect(screen.getByRole("button", { name: "Current section" })).toHaveAttribute("aria-pressed", "true");

        await user.click(screen.getByRole("button", { name: "Whole resume" }));
        await user.click(screen.getByTestId("sidebar-tab-content"));
        await user.click(screen.getByTestId("sidebar-tab-customize"));
        expect(screen.getByRole("button", { name: "Whole resume" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Current section" })).toHaveAttribute("aria-pressed", "false");
    });

    it("exposes CV language in Content and opens its region settings", async () => {
        const user = userEvent.setup();
        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        const languageSelect = screen.getByRole("combobox", { name: "CV language" });
        languageSelect.focus();
        await user.keyboard("{Enter}Bos{Enter}");
        expect(useResumeStore.getState().resume.settings).toMatchObject({
            language: "bs",
            dateFormat: "DD.MM.YYYY",
        });

        await user.click(screen.getByRole("button", { name: "Language and date settings" }));
        expect(await screen.findByTestId("customize-detail-languageRegion")).toBeInTheDocument();
    });

    it("keeps personal-detail inputs selectable by making only drag handles draggable", async () => {
        const user = userEvent.setup();
        vi.stubGlobal("Worker", class {
            addEventListener() {}
            removeEventListener() {}
            postMessage() {}
            terminate() {}
        });
        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        await user.click(screen.getByTestId("sidebar-basics-card"));
        const emailInput = screen.getByTestId("email-address-0");
        const detailCard = emailInput.closest('[data-testid^="detail-card-"]') as HTMLElement;

        expect(detailCard).toBeTruthy();
        expect(detailCard).not.toHaveAttribute("draggable");
        expect(detailCard.className).toContain("[&_input]:select-text");
        // dnd-kit drags from the handle only; the card itself never becomes draggable.
        expect(within(detailCard).getByTitle("Drag from here")).toHaveAttribute("aria-roledescription", "sortable");
    });

    it("exposes localized overlay elements from Content and opens their editor", async () => {
        const user = userEvent.setup();
        useI18nStore.setState({ locale: "bs", _hydrated: true });
        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        const overlayEntry = screen.getByTestId("content-overlay-elements");
        expect(overlayEntry).toHaveTextContent("Overlay elementi");
        await user.click(overlayEntry);

        expect(await screen.findByTestId("customize-detail-designOverlays")).toBeInTheDocument();
    });

    it("applies a circular photo shape preset", async () => {
        const user = userEvent.setup();
        const resume = createEmptyResume();
        resume.settings.personalDetails.photo.width = 120;
        resume.settings.personalDetails.photo.height = 96;
        useResumeStore.setState({ resume });

        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        await user.click(screen.getByTestId("sidebar-tab-customize"));
        await user.click(screen.getByTestId("customize-row-personalPhoto"));
        await user.click(screen.getByRole("button", { name: "Circle" }));

        expect(useResumeStore.getState().resume.settings.personalDetails.photo).toMatchObject({
            width: 96,
            height: 96,
            border: { radius: 999 },
        });
    });

    it("writes and resets section heading overrides without changing global defaults", async () => {
        const user = userEvent.setup();
        const resume = createEmptyResume();
        resume.settings.contentSections = ["experience"];
        resume.experience = [{
            id: "exp-1",
            hidden: false,
            position: "Engineer",
            company: "EngineCV",
            start: "",
            end: "",
            location: "",
            description: "",
            highlights: [],
            skills: [],
            url: "",
            urlIcon: "auto",
        }];
        useResumeStore.setState({ resume });

        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        await user.click(screen.getByTestId("sidebar-tab-customize"));
        await user.click(screen.getByRole("button", { name: "Current section" }));
        expect(screen.getByTestId("customize-section-select")).toHaveClass(
            "h-8",
            "border-transparent",
            "bg-transparent",
        );
        await user.click(screen.getByTestId("customize-row-sectionHeadings"));
        await user.click(screen.getByRole("button", { name: "Clean" }));

        expect(useResumeStore.getState().resume.customization.sectionOverrides.experience?.headings)
            .toMatchObject({ preset: "clean" });
        expect(useResumeStore.getState().resume.settings.headings.preset).toBe("baseline");

        await user.click(screen.getByRole("button", { name: "Reset overrides" }));
        expect(useResumeStore.getState().resume.customization.sectionOverrides.experience).toBeUndefined();
    });
});

describe("Languages section customize card", () => {
    beforeEach(() => {
        resetStore();
    });

    afterEach(() => {
        cleanup();
    });

    it("updates languages styling settings and layout from the customize card", async () => {
        const user = userEvent.setup();
        render(
            <TooltipProvider>
                <EditorSidebar />
            </TooltipProvider>,
        );

        await user.click(screen.getByTestId("sidebar-tab-customize"));

        await user.click(screen.getByTestId("customize-row-languagesSection"));

        await user.click(screen.getByRole("button", { name: "2" }));
        expect((useResumeStore.getState().resume.settings as any).languagesSection.columns).toBe(2);

        await user.click(screen.getByRole("button", { name: "Hidden" }));
        expect((useResumeStore.getState().resume.settings as any).languagesSection.fluencyDisplay).toBe("hidden");

        await user.click(screen.getByRole("button", { name: "Table" }));
        expect((useResumeStore.getState().resume.settings.sectionDisplay as any).languages?.languageLayout).toBe("table");
    });
});

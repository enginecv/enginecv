import { act, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyCefrSkillLevels } from "@/lib/cefr";
import { createEmptyResume, projectSchema, type Resume } from "@/lib/schema";
import { createDesignElement } from "@/lib/design";
import { useResumeStore } from "@/lib/store";
import { useI18nStore } from "@/lib/i18n";
import { ResumePreview } from "./ResumePreview";

const PX_PER_MM = 96 / 25.4;
const defaultResizeObserver = globalThis.ResizeObserver;

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
        pendingCustomizeNav: null,
        selectedCustomizeSection: null,
        selectedDesignElementId: null,
        activeDesignPage: 0,
        previewPageCount: 1,
    });
}

function createRect(height: number, width = 100): DOMRect {
    return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON: () => ({}),
    } as DOMRect;
}

function installRafController() {
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    return {
        async flushAll() {
            while (callbacks.length > 0) {
                const batch = callbacks.splice(0, callbacks.length);
                await act(async () => {
                    batch.forEach((callback) => callback(performance.now()));
                    await Promise.resolve();
                });
            }
        },
    };
}

function applySimpleBlockMeasurements(container: HTMLElement, footprints: Record<string, number>) {
    const measureContainer = container.querySelector('[data-testid="resume-preview-measure"]') as HTMLElement | null;
    expect(measureContainer).toBeTruthy();

    let offset = 0;
    const blocks = Array.from(measureContainer!.querySelectorAll<HTMLElement>("[data-page-block-key]"));
    blocks.forEach((block) => {
        const key = block.dataset.pageBlockKey || "";
        const footprint = footprints[key] ?? 0;
        const top = offset;
        offset += footprint;

        Object.defineProperty(block, "offsetTop", {
            configurable: true,
            get: () => top,
        });
        Object.defineProperty(block, "offsetHeight", {
            configurable: true,
            get: () => footprint,
        });
        block.getBoundingClientRect = () => createRect(footprint);
    });

    Object.defineProperty(measureContainer, "scrollHeight", {
        configurable: true,
        get: () => offset,
    });
}

function applyStructuredMeasurements(container: HTMLElement, heights: Record<string, number>) {
    const measureContainer = container.querySelector('[data-testid="resume-preview-structured-measure"]') as HTMLElement | null;
    expect(measureContainer).toBeTruthy();

    const nodes = Array.from(measureContainer!.querySelectorAll<HTMLElement>("[data-layout-measure]"));
    nodes.forEach((node) => {
        const key = node.dataset.layoutMeasure || "";
        const height = heights[key] ?? 0;
        // The structured pagination effect reads offsetHeight (unscaled layout
        // height), so mock that as well as getBoundingClientRect.
        Object.defineProperty(node, "offsetHeight", {
            configurable: true,
            get: () => height,
        });
        node.getBoundingClientRect = () => createRect(height);
    });
}

function createSummaryResume({
    summary = "Product-minded platform engineer focused on reliable, local-first resume workflows.",
    language = "en",
    columns = "one",
}: {
    summary?: string;
    language?: string;
    columns?: "one" | "two" | "mix";
} = {}): Resume {
    const resume = createEmptyResume();
    resume.basics.name = "Alicia Vector";
    resume.basics.summary = summary;
    resume.settings.language = language;
    resume.settings.layout.columns = columns;
    resume.settings.contentSections = ["experience"];
    resume.experience = [
        {
            id: "exp-1",
            hidden: false,
            company: "Acme Systems",
            position: "Senior Engineer",
            start: "2024-01",
            end: "Present",
            location: "Remote",
            description: "Led platform delivery",
            highlights: [],
            skills: [],
            url: "",
            urlIcon: "auto",
        },
    ];
    return resume;
}

describe("ResumePreview", () => {
    beforeEach(() => {
        resetStore();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        globalThis.ResizeObserver = defaultResizeObserver;
        resetStore();
    });

    it("renders profile and experience content from the editor store", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Alicia Vector";
        resume.basics.headline = "Platform Engineer";
        resume.basics.email = "alicia@example.com";
        resume.experience = [
            {
                id: "exp-1",
                hidden: false,
                company: "Acme Systems",
                position: "Senior Engineer",
                start: "2024-01",
                end: "Present",
                location: "Remote",
                description: "Led platform delivery",
                highlights: [],
                skills: [],
                url: "",
                urlIcon: "auto",
            },
        ];
        resume.settings.contentSections = ["experience"];

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;
        expect(previewPage).toBeTruthy();

        await waitFor(() => {
            const page = within(previewPage);
            expect(page.getByTestId("resume-preview-name")).toHaveTextContent("Alicia Vector");
            expect(page.getByText("Platform Engineer")).toBeInTheDocument();
        });

        const page = within(previewPage);
        expect(page.getByText("Experience")).toBeInTheDocument();
        expect(page.getByText("Senior Engineer")).toBeInTheDocument();
        expect(page.getByText("Acme Systems")).toBeInTheDocument();
        expect(page.getByText("alicia@example.com")).toBeInTheDocument();
        unmount();
    });

    it("omits placeholders and body spacing when an experience description is empty", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Alicia Vector";
        resume.experience = [{
            id: "exp-empty-description",
            hidden: false,
            company: "Acme Systems",
            position: "Senior Engineer",
            start: "",
            end: "",
            location: "",
            description: "",
            highlights: [],
            skills: [],
            url: "",
            urlIcon: "auto",
        }];
        resume.settings.contentSections = ["experience"];
        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;

        await waitFor(() => {
            expect(within(previewPage).getByText("Senior Engineer")).toBeInTheDocument();
        });

        expect(previewPage).not.toHaveTextContent("…");
        expect(within(previewPage).getByTestId("resume-entry").querySelector(".resume-md")).toBeNull();
    });

    it("renders every email with its user-defined label", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Alicia Vector";
        resume.basics.email = "main@example.com";
        resume.basics.emails = [
            { id: "email-main", email: "main@example.com", label: "Primary" },
            { id: "email-personal", email: "personal@example.com", label: "Personal" },
        ];
        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;

        await waitFor(() => {
            expect(within(previewPage).getByText("main@example.com")).toBeInTheDocument();
            expect(within(previewPage).getByText("personal@example.com")).toBeInTheDocument();
        });

        const page = within(previewPage);
        expect(page.getByText("Primary")).toBeInTheDocument();
        expect(page.getByText("Personal")).toBeInTheDocument();
        expect(page.getByText("main@example.com").closest("a")).toHaveAttribute("href", "mailto:main@example.com");
        expect(page.getByText("personal@example.com").closest("a")).toHaveAttribute("href", "mailto:personal@example.com");
    });

    it("keeps personal links clickable and normalizes supported URL forms", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Alicia Vector";
        resume.basics.customLinks = [{
            id: "portfolio",
            name: "Portfolio",
            label: "Case studies",
            icon: "auto",
            url: "  HTTPS://example.com/case-studies  ",
        }];
        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;
        const link = await within(previewPage).findByRole("link", { name: /Case studies/ });

        expect(link).toHaveAttribute("href", "HTTPS://example.com/case-studies");
        const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
        expect(link.dispatchEvent(click)).toBe(true);
    });

    it("keeps resume labels tied to CV language when app locale changes", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Alicia Vector";
        resume.settings.language = "en";
        resume.settings.contentSections = ["courses", "languages"];
        resume.courses = [{
            id: "course-1",
            name: "Distributed Systems",
            institution: "Open University",
            start: "",
            end: "",
            description: "",
            url: "",
            urlIcon: "auto",
            hidden: false,
        }] as Resume["courses"];
        resume.languages = [{
            id: "language-1",
            language: "English",
            fluency: "C1",
            cefrDetailed: false,
            cefr: emptyCefrSkillLevels(),
            assessmentType: "self",
            issuer: "",
            assessmentId: "",
            assessmentUrl: "",
            description: "",
            hidden: false,
        }];
        useI18nStore.setState({ locale: "de", _hydrated: true });
        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;

        await waitFor(() => {
            expect(within(previewPage).getByText("Courses")).toBeInTheDocument();
            expect(within(previewPage).getByText("Languages")).toBeInTheDocument();
            expect(within(previewPage).getByText("Self-assessed")).toBeInTheDocument();
        });
        expect(within(previewPage).queryByText("Kurse")).not.toBeInTheDocument();
        expect(within(previewPage).queryByText("Sprachen")).not.toBeInTheDocument();

        act(() => useI18nStore.setState({ locale: "bs", _hydrated: true }));
        expect(within(previewPage).getByText("Courses")).toBeInTheDocument();
        expect(within(previewPage).getByText("Languages")).toBeInTheDocument();
    });

    it("renders Bosnian nationality wording instead of the country name", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Alicia Vector";
        resume.basics.nationality = "Serbia";
        resume.settings.language = "bs";
        resume.settings.nationalityDisplay = "name";
        resume.settings.nationalityNameStyle = "nationality";
        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;

        await waitFor(() => expect(within(previewPage).getByText("Srpsko")).toBeInTheDocument());
        expect(within(previewPage).getByText("Državljanstvo:")).toBeInTheDocument();
        expect(within(previewPage).queryByText("Serbia")).not.toBeInTheDocument();
    });

    it("keeps a blank project title blank while localizing its Bosnian section", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Alicia Vector";
        resume.settings.language = "bs";
        resume.settings.contentSections = ["projects"];
        resume.projects = [{
            id: "project-blank-title",
            hidden: false,
            name: "",
            subtitle: "",
            description: "- Prvi projekat\n- Drugi projekat",
            highlights: [],
            keywords: [],
            skills: [],
            start: "",
            end: "",
            url: "",
            urlIcon: "auto",
            repos: [],
            icon: "",
            visibility: "",
        }];
        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;

        await waitFor(() => expect(within(previewPage).getByText("Projekti")).toBeInTheDocument());
        expect(within(previewPage).queryByText("Projekat")).not.toBeInTheDocument();
        expect(within(previewPage).getByText("Prvi projekat")).toBeInTheDocument();
    });

    it("shows a project icon and, only when Customize asks, GitHub visibility in the CV language", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Alicia Vector";
        resume.settings.language = "de";
        resume.settings.contentSections = ["projects"];
        resume.projects = [
            projectSchema.parse({ id: "gh", name: "Tracepipe", icon: "terminal", visibility: "private", url: "https://github.com/alicia/tracepipe" }),
            projectSchema.parse({ id: "other", name: "Offline Notes", visibility: "public", url: "https://example.com" }),
        ];
        useResumeStore.setState({ resume, paperSize: "a4" });

        const first = render(<ResumePreview />);
        const page = first.container.querySelector(".resume-page") as HTMLElement;
        await waitFor(() => expect(within(page).getByText("Tracepipe")).toBeInTheDocument());
        expect(within(page).getAllByTestId("project-icon")).toHaveLength(1);
        expect(within(page).queryByTestId("project-visibility")).toBeNull();
        first.unmount();

        useResumeStore.setState({
            resume: { ...resume, settings: { ...resume.settings, repoBadge: { ...resume.settings.repoBadge, showVisibility: true } } },
            paperSize: "a4",
        });
        const second = render(<ResumePreview />);
        const shown = second.container.querySelector(".resume-page") as HTMLElement;
        await waitFor(() => expect(within(shown).getByTestId("project-visibility")).toHaveTextContent("Privat"));
        // Only GitHub projects carry a visibility, whatever the stored value.
        expect(within(shown).getAllByTestId("project-visibility")).toHaveLength(1);
    });

    it("renders entry skills as badges only when the toggle is on", async () => {
        const baseResume = createEmptyResume();
        baseResume.basics.name = "Alicia Vector";
        baseResume.projects = [
            {
                id: "proj-1",
                hidden: false,
                name: "Local-first Resume Engine",
                subtitle: "Personal",
                description: "Offline resume builder",
                highlights: [],
                keywords: [],
                skills: ["TypeScript", "IndexedDB"],
                start: "",
                end: "",
                url: "",
                urlIcon: "auto",
                repos: [],
                icon: "",
                visibility: "",
            },
        ] as Resume["projects"];
        baseResume.settings.contentSections = ["projects"];

        // Toggle off (default): skills-used stays hidden in the preview.
        useResumeStore.setState({ resume: baseResume, paperSize: "a4" });
        const off = render(<ResumePreview />);
        const offPage = off.container.querySelector(".resume-page") as HTMLElement;
        await waitFor(() => {
            expect(within(offPage).getByText("Local-first Resume Engine")).toBeInTheDocument();
        });
        expect(within(offPage).queryByTestId("resume-entry-skills")).toBeNull();
        off.unmount();

        // Toggle on: skills render as badges under the project entry.
        const resumeOn: Resume = {
            ...baseResume,
            settings: {
                ...baseResume.settings,
                entryLayout: { ...baseResume.settings.entryLayout, showEntrySkills: true },
            },
        };
        useResumeStore.setState({ resume: resumeOn, paperSize: "a4" });
        const on = render(<ResumePreview />);
        const onPage = on.container.querySelector(".resume-page") as HTMLElement;
        await waitFor(() => {
            expect(within(onPage).getByText("Local-first Resume Engine")).toBeInTheDocument();
        });
        const badges = within(onPage).getByTestId("resume-entry-skills");
        expect(within(badges).getByText("TypeScript")).toBeInTheDocument();
        expect(within(badges).getByText("IndexedDB")).toBeInTheDocument();
        on.unmount();
    });

    it("renders a custom section per its layout mode", async () => {
        const makeResume = (custom: Resume["customSections"][number]): Resume => {
            const resume = createEmptyResume();
            resume.basics.name = "Alicia Vector";
            resume.customSections = [custom];
            resume.settings.contentSections = [`custom:${custom.id}`];
            return resume;
        };
        const baseCustom = {
            id: "cs-1", hidden: false, title: "Volunteering", icon: "auto",
            text: "", tags: [] as string[], entries: [] as Resume["customSections"][number]["entries"],
        };

        // entries layout
        const entriesResume = makeResume({
            ...baseCustom,
            layout: "entries",
            entries: [{
                id: "ce-1", hidden: false, title: "Red Cross", subtitle: "Volunteer",
                start: "", end: "", location: "", description: "Coordinated drives",
                skills: [], url: "", urlIcon: "auto",
            }],
        });
        useResumeStore.setState({ resume: entriesResume, paperSize: "a4" });
        const a = render(<ResumePreview />);
        const aPage = a.container.querySelector(".resume-page") as HTMLElement;
        await waitFor(() => {
            expect(within(aPage).getByText("Volunteering")).toBeInTheDocument();
        });
        expect(within(aPage).getByText("Red Cross")).toBeInTheDocument();
        expect(within(aPage).getByText("Coordinated drives")).toBeInTheDocument();
        a.unmount();

        // tags layout
        const tagsResume = makeResume({ ...baseCustom, layout: "tags", tags: ["React", "Node"] });
        useResumeStore.setState({ resume: tagsResume, paperSize: "a4" });
        const b = render(<ResumePreview />);
        const bPage = b.container.querySelector(".resume-page") as HTMLElement;
        await waitFor(() => {
            expect(within(bPage).getByText("Volunteering")).toBeInTheDocument();
        });
        expect(within(bPage).getByText("React")).toBeInTheDocument();
        expect(within(bPage).getByText("Node")).toBeInTheDocument();
        b.unmount();

        // text layout
        const textResume = makeResume({ ...baseCustom, layout: "text", text: "A short prose blurb." });
        useResumeStore.setState({ resume: textResume, paperSize: "a4" });
        const c = render(<ResumePreview />);
        const cPage = c.container.querySelector(".resume-page") as HTMLElement;
        await waitFor(() => {
            expect(within(cPage).getByText("Volunteering")).toBeInTheDocument();
        });
        expect(within(cPage).getByText("A short prose blurb.")).toBeInTheDocument();
        c.unmount();
    });

    it("does not render sections listed in hiddenSections", async () => {
        const resume = createSummaryResume();
        resume.settings.contentSections = ["experience"];
        resume.settings.hiddenSections = ["experience"];
        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container, unmount } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;

        await waitFor(() => {
            expect(within(previewPage).getByTestId("resume-preview-name")).toHaveTextContent("Alicia Vector");
        });

        expect(within(previewPage).queryByText("Experience")).toBeNull();
        expect(within(previewPage).queryByText("Acme Systems")).toBeNull();
        unmount();
    });

    it("skips hidden entries while rendering visible siblings", async () => {
        const resume = createSummaryResume();
        resume.experience = [
            { ...resume.experience[0], id: "exp-1", position: "Visible Role", company: "Visible Co" },
            {
                ...resume.experience[0],
                id: "exp-2",
                position: "Hidden Role",
                company: "Hidden Co",
                hidden: true,
            },
        ];
        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container, unmount } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;

        await waitFor(() => {
            expect(within(previewPage).getByText("Visible Role")).toBeInTheDocument();
        });

        expect(within(previewPage).queryByText("Hidden Role")).toBeNull();
        expect(within(previewPage).getByText("Experience")).toBeInTheDocument();
        unmount();
    });

    it("suppresses the section heading when every entry is hidden", async () => {
        const resume = createSummaryResume();
        resume.experience = [{ ...resume.experience[0], hidden: true }];
        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container, unmount } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;

        await waitFor(() => {
            expect(within(previewPage).getByTestId("resume-preview-name")).toHaveTextContent("Alicia Vector");
        });

        expect(within(previewPage).queryByText("Experience")).toBeNull();
        unmount();
    });

    it("renders duplicate skill ids without React key warnings", () => {
        const resume = createEmptyResume();
        resume.skillGroups = [
            {
                id: "ungrouped",
                name: "",
                hidden: false,
                skills: [
                    {
                        id: "github-skill-c",
                        hidden: false,
                        name: "C",
                        description: "",
                        level: "competent",
                        icon: "auto",
                        display: "name" as const,
                        keywords: [],
                    },
                    {
                        id: "github-skill-c",
                        hidden: false,
                        name: "C++",
                        description: "",
                        level: "competent",
                        icon: "auto",
                        display: "name" as const,
                        keywords: [],
                    },
                ],
            },
        ];
        resume.settings.contentSections = ["skills"];
        useResumeStore.setState({ resume });
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

        const { container, unmount } = render(<ResumePreview />);

        expect(container.querySelectorAll('[data-testid="resume-skill"]').length).toBeGreaterThanOrEqual(2);
        expect(
            consoleError.mock.calls.some((call) =>
                call.some((value) => String(value).includes("Encountered two children with the same key")),
            ),
        ).toBe(false);
        unmount();
    });

    it("renders configured interests with markdown details", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Alicia Vector";
        resume.settings.contentSections = ["interests"];
        resume.interests = [
            {
                id: "interest-1",
                hidden: false,
                name: "Open-source communities",
                description: "**Maintainer** for accessibility tooling.",
            },
            {
                id: "interest-2",
                hidden: false,
                name: "Trail running",
                description: "Volunteer route planner for local clubs.",
            },
        ];

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;
        expect(previewPage).toBeTruthy();

        await waitFor(() => {
            const page = within(previewPage);
            expect(page.getByText("Interests")).toBeInTheDocument();
            expect(page.getByText("Open-source communities")).toBeInTheDocument();
        });

        const page = within(previewPage);
        expect(page.getByText("Maintainer")).toBeInTheDocument();
        expect(page.getByText("Volunteer route planner for local clubs.")).toBeInTheDocument();
        unmount();
    });

    it("renders standardized languages in the table preview with markdown details", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Alicia Vector";
        resume.settings.contentSections = ["languages"];
        resume.settings.sectionDisplay = {
            languages: {
                languageLayout: "table",
            },
        };
        resume.languages = [
            {
                id: "language-1",
                hidden: false,
                language: "English",
                fluency: "C1",
                cefrDetailed: false,
                cefr: emptyCefrSkillLevels(),
                assessmentType: "issuer",
                issuer: "IELTS",
                assessmentId: "TRF-12345",
                assessmentUrl: "https://ielts.org/verify/TRF-12345",
                description: "**Academic** certification.",
            },
            {
                id: "language-2",
                hidden: false,
                language: "Bosnian",
                fluency: "Native",
                cefrDetailed: false,
                cefr: emptyCefrSkillLevels(),
                assessmentType: "none",
                issuer: "",
                assessmentId: "",
                assessmentUrl: "",
                description: "",
            },
        ];

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;
        expect(previewPage).toBeTruthy();

        await waitFor(() => {
            const page = within(previewPage);
            expect(page.getByText("Languages")).toBeInTheDocument();
            expect(page.getByTestId("resume-languages-table")).toBeInTheDocument();
            expect(page.getByText("English")).toBeInTheDocument();
        });

        const page = within(previewPage);
        expect(page.getByText("C1")).toBeInTheDocument();
        expect(page.getByText("Issued by an organisation: IELTS")).toBeInTheDocument();
        expect(page.getByText("Assessment ID: TRF-12345")).toBeInTheDocument();
        expect(page.getByRole("link", { name: /Issued by an organisation: IELTS/ })).toHaveAttribute(
            "href",
            "https://ielts.org/verify/TRF-12345",
        );
        expect(page.getByText("Academic")).toBeInTheDocument();
        expect(page.getByText("Native")).toBeInTheDocument();
        expect(page.queryByText("Self-assessed")).not.toBeInTheDocument();
        unmount();
    });

    it("renders the CEFR grid with mother tongues, per-skill levels and single-level rows", async () => {
        const resume = createEmptyResume();
        resume.settings.contentSections = ["languages"];
        resume.settings.sectionDisplay = { languages: { languageLayout: "cefr" } };
        const blankGrid = { listening: "", reading: "", spokenInteraction: "", spokenProduction: "", writing: "" };
        const base = { hidden: false, assessmentType: "none" as const, issuer: "", assessmentId: "", assessmentUrl: "", description: "" };
        resume.languages = [
            { ...base, id: "bs", language: "Bosnian", fluency: "Native", cefrDetailed: false, cefr: blankGrid },
            {
                ...base,
                id: "en",
                language: "English",
                fluency: "C1",
                cefrDetailed: true,
                cefr: { listening: "C2", reading: "C2", spokenInteraction: "C1", spokenProduction: "B2", writing: "" },
                description: "Lived in Dublin.",
            },
            { ...base, id: "de", language: "German", fluency: "A2", cefrDetailed: false, cefr: blankGrid },
        ];
        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container, unmount } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;

        await waitFor(() => {
            expect(within(previewPage).getByTestId("resume-languages-cefr")).toBeInTheDocument();
        });

        const page = within(previewPage);
        expect(page.getByTestId("resume-languages-mother-tongues")).toHaveTextContent("Mother tongue(s): Bosnian");
        const grid = within(page.getByTestId("resume-languages-cefr"));
        for (const heading of ["Understanding", "Speaking", "Writing", "Listening", "Reading", "Spoken interaction", "Spoken production"]) {
            expect(grid.getByText(heading)).toBeInTheDocument();
        }
        expect(grid.queryByText("Bosnian")).not.toBeInTheDocument();

        const [englishRow, germanRow] = grid.getAllByTestId("resume-language-cefr-row");
        expect(Array.from(englishRow.querySelectorAll("td")).map((cell) => cell.textContent)).toEqual(["English", "C2", "C2", "C1", "B2", "–"]);
        const germanCells = germanRow.querySelectorAll("td");
        expect(germanCells).toHaveLength(2);
        expect(germanCells[1]).toHaveAttribute("colspan", "5");
        expect(germanCells[1]).toHaveTextContent("A2");
        expect(grid.getByText("Lived in Dublin.")).toBeInTheDocument();
        unmount();
    });

    it("labels the CEFR grid in the CV language", async () => {
        const resume = createEmptyResume();
        resume.settings.language = "de";
        resume.settings.contentSections = ["languages"];
        resume.settings.sectionDisplay = { languages: { languageLayout: "cefr" } };
        resume.languages = [{
            id: "fr", hidden: false, language: "Französisch", fluency: "B1", cefrDetailed: true,
            cefr: { listening: "B1", reading: "B1", spokenInteraction: "B1", spokenProduction: "B1", writing: "B1" },
            assessmentType: "self", issuer: "", assessmentId: "", assessmentUrl: "", description: "",
        }];
        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container, unmount } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;
        await waitFor(() => {
            expect(within(previewPage).getByText("An Gesprächen teilnehmen")).toBeInTheDocument();
        });
        expect(within(previewPage).getByText("Verstehen")).toBeInTheDocument();
        unmount();
    });

    it("omits the assessment column when no language has an assessment", async () => {
        const resume = createEmptyResume();
        resume.settings.contentSections = ["languages"];
        resume.settings.sectionDisplay = {
            languages: {
                languageLayout: "table",
            },
        };
        resume.languages = [{
            id: "language-native",
            hidden: false,
            language: "Bosnian",
            fluency: "Native",
            cefrDetailed: false,
            cefr: emptyCefrSkillLevels(),
            assessmentType: "none",
            issuer: "",
            assessmentId: "",
            assessmentUrl: "",
            description: "",
        }];

        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container, unmount } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;
        await waitFor(() => expect(within(previewPage).getByText("Bosnian")).toBeInTheDocument());

        const table = within(previewPage).getByTestId("resume-languages-table");
        expect(within(table).queryByText("Assessment")).not.toBeInTheDocument();
        expect(within(table).queryByText("Self-assessed")).not.toBeInTheDocument();
        unmount();
    });

    it("renders the languages list as a multi-column grid with hidden fluency when configured", async () => {
        const resume = createEmptyResume();
        resume.settings.contentSections = ["languages"];
        resume.settings.languagesSection = {
            columns: 2,
            columnGap: 24,
            itemSpacing: 4,
            fluencyDisplay: "hidden",
            fluencySize: 0.85,
            fluencyPlacement: "nextLine",
            fluencyOrder: "languageFirst",
            textAlign: "left",
            tableCellPaddingX: 8,
            tableCellPaddingY: 6,
        };
        resume.languages = [
            {
                id: "language-1",
                hidden: false,
                language: "English",
                fluency: "C1",
                cefrDetailed: false,
                cefr: emptyCefrSkillLevels(),
                assessmentType: "none",
                issuer: "",
                assessmentId: "",
                assessmentUrl: "",
                description: "",
            },
            {
                id: "language-2",
                hidden: false,
                language: "German",
                fluency: "B2",
                cefrDetailed: false,
                cefr: emptyCefrSkillLevels(),
                assessmentType: "none",
                issuer: "",
                assessmentId: "",
                assessmentUrl: "",
                description: "",
            },
        ];

        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container, unmount } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;
        await waitFor(() => expect(within(previewPage).getByText("English")).toBeInTheDocument());

        const grid = within(previewPage).getByTestId("resume-languages-grid");
        expect(grid.style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
        expect(grid.style.columnGap).toBe("24px");
        expect(grid.style.rowGap).toBe("4px");
        expect(within(grid).getByText("German")).toBeInTheDocument();
        expect(within(grid).queryByText("C1")).not.toBeInTheDocument();
        expect(within(grid).queryByText("B2")).not.toBeInTheDocument();
        unmount();
    });

    it("applies fluency text mode with custom size in the list layout", async () => {
        const resume = createEmptyResume();
        resume.settings.contentSections = ["languages"];
        resume.settings.languagesSection = {
            columns: 1,
            columnGap: 16,
            itemSpacing: null,
            fluencyDisplay: "text",
            fluencySize: 1,
            fluencyPlacement: "nextLine",
            fluencyOrder: "languageFirst",
            textAlign: "left",
            tableCellPaddingX: 8,
            tableCellPaddingY: 6,
        };
        resume.languages = [{
            id: "language-1",
            hidden: false,
            language: "English",
            fluency: "C1",
            cefrDetailed: false,
            cefr: emptyCefrSkillLevels(),
            assessmentType: "none",
            issuer: "",
            assessmentId: "",
            assessmentUrl: "",
            description: "",
        }];

        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container, unmount } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;
        await waitFor(() => expect(within(previewPage).getByText("English")).toBeInTheDocument());

        // Text mode sets the level in plain parentheses, with no badge.
        const fluency = within(previewPage).getAllByText("(C1)")[0];
        expect(fluency.style.fontSize).toBe("1em");
        expect(fluency.className).not.toContain("border-current/20");
        unmount();
    });

    it("applies custom cell padding to the languages table", async () => {
        const resume = createEmptyResume();
        resume.settings.contentSections = ["languages"];
        resume.settings.sectionDisplay = {
            languages: {
                languageLayout: "table",
            },
        };
        resume.settings.languagesSection = {
            columns: 1,
            columnGap: 16,
            itemSpacing: null,
            fluencyDisplay: "badge",
            fluencySize: 0.85,
            fluencyPlacement: "nextLine",
            fluencyOrder: "languageFirst",
            textAlign: "center",
            tableCellPaddingX: 12,
            tableCellPaddingY: 10,
        };
        resume.languages = [{
            id: "language-1",
            hidden: false,
            language: "English",
            fluency: "C1",
            cefrDetailed: false,
            cefr: emptyCefrSkillLevels(),
            assessmentType: "none",
            issuer: "",
            assessmentId: "",
            assessmentUrl: "",
            description: "",
        }];

        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container, unmount } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;
        await waitFor(() => expect(within(previewPage).getByText("English")).toBeInTheDocument());

        const table = within(previewPage).getByTestId("resume-languages-table");
        const cells = Array.from(table.querySelectorAll("th, td")) as HTMLElement[];
        expect(cells.length).toBeGreaterThan(2);
        for (const cell of cells) {
            expect(cell.style.paddingLeft).toBe("12px");
            expect(cell.style.paddingTop).toBe("10px");
            expect(cell.style.textAlign).toBe("center");
        }
        unmount();
    });

    it("places fluency inline with the language name in the configured order and alignment", async () => {
        const resume = createEmptyResume();
        resume.settings.contentSections = ["languages"];
        resume.settings.languagesSection = {
            columns: 1,
            columnGap: 16,
            itemSpacing: null,
            fluencyDisplay: "badge",
            fluencySize: 0.85,
            fluencyPlacement: "sameLine",
            fluencyOrder: "fluencyFirst",
            textAlign: "right",
            tableCellPaddingX: 8,
            tableCellPaddingY: 6,
        };
        resume.languages = [{
            id: "language-1",
            hidden: false,
            language: "English",
            fluency: "C1",
            cefrDetailed: false,
            cefr: emptyCefrSkillLevels(),
            assessmentType: "self",
            issuer: "",
            assessmentId: "",
            assessmentUrl: "",
            description: "",
        }];

        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container, unmount } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;
        await waitFor(() => expect(within(previewPage).getByText("English")).toBeInTheDocument());

        const inline = within(previewPage).getByTestId("resume-language-inline");
        expect(inline.textContent).toContain("C1English");
        // Assessment joins the same inline row instead of dropping to the next line.
        expect(inline.textContent).toContain("Self-assessed");

        const entry = within(previewPage).getAllByTestId("resume-entry")[0];
        expect(entry.style.textAlign).toBe("right");
        unmount();
    });

    it("uses layout zoom instead of transform scaling for crisp live preview rendering", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Scale Check";
        resume.experience = [
            {
                id: "exp-1",
                hidden: false,
                company: "Vector Labs",
                position: "Designer",
                start: "2024-01",
                end: "Present",
                location: "Remote",
                description: "Test content",
                highlights: [],
                skills: [],
                url: "",
                urlIcon: "auto",
            },
        ];
        resume.settings.contentSections = ["experience"];

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;
        expect(previewPage).toBeTruthy();

        await waitFor(() => {
            expect(previewPage.style.zoom).not.toBe("");
        });

        expect(previewPage.style.transform).toBe("");
        unmount();
    });

    it("applies section content styles to the entry wrapper", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Styled Entry";
        resume.experience = [
            {
                id: "exp-1",
                hidden: false,
                company: "Vector Labs",
                position: "Frontend Engineer",
                start: "2024-01",
                end: "Present",
                location: "Remote",
                description: "Owns entry visuals",
                highlights: [],
                skills: [],
                url: "",
                urlIcon: "auto",
            },
        ];
        resume.settings.contentSections = ["experience"];
        resume.settings.contentStyle = {
            paddingTop: 8,
            paddingBottom: 12,
            paddingLeft: 10,
            paddingRight: 14,
            marginTop: 3,
            marginBottom: 6,
            marginLeft: 2,
            marginRight: 4,
            border: {
                style: "solid",
                width: 2,
                color: "#123456",
                radius: 8,
                top: true,
                bottom: true,
                left: true,
                right: true,
                dashLength: 6,
                dashGap: 4,
            },
            backgroundColor: "#ffeeee",
            preset: "card",
        };

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;
        expect(previewPage).toBeTruthy();

        await waitFor(() => {
            expect(container.querySelector('[data-testid="resume-entry"]')).toBeTruthy();
        });

        const entry = container.querySelector('[data-testid="resume-entry"]') as HTMLElement;
        expect(entry.style.paddingTop).toBe("8px");
        expect(entry.style.paddingBottom).toBe("12px");
        expect(entry.style.marginBottom).toBe("16px");
        expect(entry.style.backgroundColor).toBe("rgb(255, 238, 238)");
        expect(entry.style.borderTopWidth).toBe("2px");
        expect(entry.style.borderTopStyle).toBe("solid");
        expect(entry.style.borderTopColor).toBe("rgb(18, 52, 86)");
        unmount();
    });

    it("emits heading margins for all four directions", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Heading Margins";
        resume.experience = [
            {
                id: "exp-1",
                hidden: false,
                company: "Margin Labs",
                position: "Engineer",
                start: "2024-01",
                end: "Present",
                location: "Remote",
                description: "",
                highlights: [],
                skills: [],
                url: "",
                urlIcon: "auto",
            },
        ];
        resume.settings.contentSections = ["experience"];
        resume.settings.headings = {
            ...resume.settings.headings,
            marginTop: 7,
            marginBottom: 13,
            marginLeft: 5,
            marginRight: 9,
        };

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);

        await waitFor(() => {
            expect(container.querySelector("style")?.textContent).toContain("margin-top: 7px;");
        });

        const styleText = container.querySelector("style")?.textContent || "";
        expect(styleText).toContain("margin-top: 7px;");
        expect(styleText).toContain("margin-bottom: 13px;");
        expect(styleText).toContain("margin-left: 5px;");
        expect(styleText).toContain("margin-right: 9px;");
        unmount();
    });

    it("applies customized heading styles to rendered section headings", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Heading Styles";
        resume.experience = [
            {
                id: "exp-1",
                hidden: false,
                company: "Style Labs",
                position: "Engineer",
                start: "2024-01",
                end: "Present",
                location: "Remote",
                description: "",
                highlights: [],
                skills: [],
                url: "",
                urlIcon: "auto",
            },
        ];
        resume.settings.contentSections = ["experience"];
        resume.settings.headings = {
            ...resume.settings.headings,
            fontSize: 18,
            textAlign: "center",
            paddingTop: 5,
            paddingBottom: 7,
            backgroundColor: "#eef0ff",
            borderColor: "#123456",
            border: {
                ...resume.settings.headings.border,
                style: "solid",
                width: 3,
                color: "",
                radius: 6,
                top: true,
                bottom: true,
                left: true,
                right: true,
            },
        };

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);

        const heading = await waitFor(() => {
            const element = container.querySelector<HTMLElement>('[data-preview-section-heading="experience"] .heading-style');
            expect(element).toBeTruthy();
            return element as HTMLElement;
        });

        const styleText = container.querySelector("style")?.textContent || "";
        expect(styleText).toMatch(/\.resume-preview-scope-[\w-]+ \.resume-document \.heading-style/);
        expect(styleText).not.toMatch(/\.resume-document\s+\.resume-preview-scope-[\w-]+\s+\.heading-style/);

        const styles = getComputedStyle(heading);
        expect(styles.backgroundColor).toBe("rgb(238, 240, 255)");
        expect(styles.paddingTop).toBe("5px");
        expect(styles.paddingBottom).toBe("7px");
        expect(styles.borderTopWidth).toBe("3px");
        expect(styles.borderTopStyle).toBe("solid");
        expect(styles.borderTopColor).toBe("rgb(18, 52, 86)");
        unmount();
    });

    it("renders the profile photo and uses the configured personal-details layouts", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Mira Hart";
        resume.basics.photo = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
        resume.basics.email = "mira@example.com";
        resume.basics.phone = "+38761123456";
        resume.basics.location = "Sarajevo";
        resume.settings.personalDetails = {
            ...resume.settings.personalDetails,
            alignment: "center",
            layout: "imageTop",
            detailsLayout: "twoColumns",
        };

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;
        expect(previewPage).toBeTruthy();

        await waitFor(() => {
            const page = within(previewPage);
            expect(page.getByTestId("resume-preview-photo")).toBeInTheDocument();
            expect(page.getByTestId("resume-preview-contact-items")).toHaveAttribute("data-layout", "twoColumns");
        });

        const page = within(previewPage);
        expect(page.getByTestId("resume-preview-header")).toHaveAttribute("data-profile-layout", "imageTop");
        expect(page.getByText("mira@example.com")).toBeInTheDocument();
        expect(previewPage.querySelector('a[href="tel:+38761123456"]')).toBeTruthy();
        expect(page.getByText("061 123 456")).toBeInTheDocument();
        unmount();
    });

    it("applies customized profile photo frame sizing, spacing, border, and filters", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Filtered Photo";
        resume.basics.photo = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
        resume.settings.personalDetails = {
            ...resume.settings.personalDetails,
            photo: {
                width: 140,
                height: 118,
                paddingTop: 6,
                paddingBottom: 8,
                paddingLeft: 10,
                paddingRight: 12,
                marginTop: 4,
                marginBottom: 5,
                marginLeft: 7,
                marginRight: 9,
                border: {
                    style: "solid",
                    width: 2,
                    color: "#123456",
                    radius: 12,
                    top: true,
                    bottom: true,
                    left: true,
                    right: true,
                    dashLength: 6,
                    dashGap: 4,
                },
                filter: {
                    preset: "custom",
                    brightness: 104,
                    contrast: 112,
                    saturate: 125,
                    grayscale: 8,
                    sepia: 16,
                    hueRotate: 12,
                    blur: 0.6,
                },
            },
        };

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);

        await waitFor(() => {
            expect(container.querySelector('[data-testid="resume-preview-photo-frame"]')).toBeTruthy();
        });

        const photo = container.querySelector('[data-testid="resume-preview-photo"]') as HTMLElement;
        const frame = container.querySelector('[data-testid="resume-preview-photo-frame"]') as HTMLElement;
        const size = container.querySelector('[data-testid="resume-preview-photo-size"]') as HTMLElement;
        const image = container.querySelector('[data-testid="resume-preview-photo-image"]') as HTMLElement;

        expect(photo.style.marginTop).toBe("4px");
        expect(photo.style.marginRight).toBe("9px");
        expect(photo.style.marginBottom).toBe("5px");
        expect(photo.style.marginLeft).toBe("7px");
        expect(frame.style.paddingTop).toBe("6px");
        expect(frame.style.paddingRight).toBe("12px");
        expect(frame.style.paddingBottom).toBe("8px");
        expect(frame.style.paddingLeft).toBe("10px");
        expect(frame.style.borderTopWidth).toBe("2px");
        expect(frame.style.borderTopStyle).toBe("solid");
        expect(frame.style.borderTopColor).toBe("rgb(18, 52, 86)");
        expect(size.style.width).toBe("140px");
        expect(size.style.height).toBe("118px");
        expect(image.style.filter).toContain("brightness(104%)");
        expect(image.style.filter).toContain("contrast(112%)");
        expect(image.style.filter).toContain("blur(0.6px)");
        unmount();
    });

    it("applies hero profile padding, margin, and border to the header container", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Header Frame";
        resume.basics.email = "frame@example.com";
        resume.settings.personalDetails = {
            ...resume.settings.personalDetails,
            paddingTop: 8,
            paddingBottom: 10,
            paddingLeft: 12,
            paddingRight: 14,
            marginTop: 3,
            marginBottom: 5,
            marginLeft: 7,
            marginRight: 9,
            border: {
                style: "solid",
                width: 2,
                color: "#654321",
                radius: 10,
                top: true,
                bottom: true,
                left: true,
                right: true,
                dashLength: 6,
                dashGap: 4,
            },
        };

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);

        await waitFor(() => {
            expect(container.querySelector('[data-testid="resume-preview-header"]')).toBeTruthy();
        });

        const header = container.querySelector('[data-testid="resume-preview-header"]') as HTMLElement;
        expect(header.style.paddingTop).toBe("8px");
        expect(header.style.paddingRight).toBe("14px");
        expect(header.style.paddingBottom).toBe("10px");
        expect(header.style.paddingLeft).toBe("12px");
        expect(header.style.marginTop).toBe("3px");
        expect(header.style.marginRight).toBe("9px");
        expect(header.style.marginBottom).toBe("5px");
        expect(header.style.marginLeft).toBe("7px");
        expect(header.style.borderTopWidth).toBe("2px");
        expect(header.style.borderTopStyle).toBe("solid");
        expect(header.style.borderTopColor).toBe("rgb(101, 67, 33)");
        unmount();
    });

    it("updates the preview document padding immediately when horizontal page margins change", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Margin Refresh";

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);

        await waitFor(() => {
            expect(container.querySelector("style")?.textContent).toContain("padding: 18mm 20mm;");
        });

        useResumeStore.setState((state) => ({
            resume: {
                ...state.resume,
                settings: {
                    ...state.resume.settings,
                    spacing: {
                        ...state.resume.settings.spacing,
                        marginH: 24,
                    },
                },
            },
        }));

        await waitFor(() => {
            expect(container.querySelector("style")?.textContent).toContain("padding: 18mm 24mm;");
        });

        unmount();
    });

    it("renders layout separators from the document flow order", async () => {
        const resume = createEmptyResume();
        resume.experience = [
            {
                id: "exp-1",
                hidden: false,
                company: "Acme Systems",
                position: "Senior Engineer",
                start: "2024-01",
                end: "Present",
                location: "Remote",
                description: "",
                highlights: [],
                skills: [],
                url: "",
                urlIcon: "auto",
            },
        ];
        resume.education = [
            {
                id: "edu-1",
                hidden: false,
                institution: "Stanford University",
                area: "Computer Science",
                studyType: "BSc",
                start: "2020-01",
                end: "2023-01",
                location: "California",
                description: "",
                score: "",
                courses: [],
                skills: [],
                url: "",
                urlIcon: "auto",
            },
        ];
        resume.settings.contentSections = ["experience", "education"];
        resume.settings.layout.sectionOrder = ["experience", "separator:test", "education"];

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);
        const previewPage = container.querySelector(".resume-page") as HTMLElement;

        await waitFor(() => {
            expect(previewPage.querySelectorAll("hr")).toHaveLength(1);
        });

        expect(previewPage.querySelectorAll("hr")).toHaveLength(1);
        unmount();
    });

    it("pairs adjacent sections into a horizontal row when the document flow includes a vertical separator", async () => {
        const resume = createEmptyResume();
        resume.experience = [
            {
                id: "exp-1",
                hidden: false,
                company: "Acme Systems",
                position: "Senior Engineer",
                start: "2024-01",
                end: "Present",
                location: "Remote",
                description: "",
                highlights: [],
                skills: [],
                url: "",
                urlIcon: "auto",
            },
        ];
        resume.education = [
            {
                id: "edu-1",
                hidden: false,
                institution: "Stanford University",
                area: "Computer Science",
                studyType: "BSc",
                start: "2020-01",
                end: "2023-01",
                location: "California",
                description: "",
                score: "",
                courses: [],
                skills: [],
                url: "",
                urlIcon: "auto",
            },
        ];
        resume.settings.contentSections = ["experience", "education"];
        resume.settings.layout.sectionOrder = ["experience", "vertical-separator:test", "education"];
        resume.settings.layout.columns = "two";
        resume.settings.layout.leftColumnWidth = 35;

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);

        await waitFor(() => {
            const previewPage = container.querySelector(".resume-page");
            expect(previewPage).toBeTruthy();
            expect(previewPage?.querySelectorAll("[data-layout-section-pair]")).toHaveLength(1);
        });

        const previewPage = container.querySelector(".resume-page") as HTMLElement;
        const pairedSection = previewPage.querySelector("[data-layout-section-pair]") as HTMLElement;
        expect(pairedSection).toBeTruthy();
        expect(within(pairedSection).getByText("Experience")).toBeInTheDocument();
        expect(within(pairedSection).getByText("Education")).toBeInTheDocument();
        expect(pairedSection.querySelectorAll("[data-layout-vertical-separator]")).toHaveLength(1);
        const paperWidth = 794;
        const marginHorizontalPx = 20 * PX_PER_MM;
        const layoutContentWidth = paperWidth - (marginHorizontalPx * 2);
        const separatorThickness = 1;
        const expectedLeftWidth = ((layoutContentWidth - separatorThickness) * 35) / 100;
        const expectedRightWidth = layoutContentWidth - separatorThickness - expectedLeftWidth;
        expect(pairedSection.style.gridTemplateColumns).toBe(`${expectedLeftWidth}px ${separatorThickness}px ${expectedRightWidth}px`);
        unmount();
    });

    it("starts a new preview page when the document flow includes a page break", async () => {
        const resume = createEmptyResume();
        resume.experience = [
            {
                id: "exp-1",
                hidden: false,
                company: "Acme Systems",
                position: "Senior Engineer",
                start: "2024-01",
                end: "Present",
                location: "Remote",
                description: "",
                highlights: [],
                skills: [],
                url: "",
                urlIcon: "auto",
            },
        ];
        resume.education = [
            {
                id: "edu-1",
                hidden: false,
                institution: "Stanford University",
                area: "Computer Science",
                studyType: "BSc",
                start: "2020-01",
                end: "2023-01",
                location: "California",
                description: "",
                score: "",
                courses: [],
                skills: [],
                url: "",
                urlIcon: "auto",
            },
        ];
        resume.settings.contentSections = ["experience", "education"];
        resume.settings.layout.sectionOrder = ["experience", "pagebreak:test", "education"];

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);

        await waitFor(() => {
            expect(container.querySelectorAll(".resume-page")).toHaveLength(2);
        });

        expect(container.querySelectorAll(".resume-page")).toHaveLength(2);
        unmount();
    });

    it("renders design overlay elements on their assigned pages", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Overlay Layout";
        resume.experience = [
            {
                id: "exp-1",
                hidden: false,
                company: "Acme Systems",
                position: "Senior Engineer",
                start: "2024-01",
                end: "Present",
                location: "Remote",
                description: "",
                highlights: [],
                skills: [],
                url: "",
                urlIcon: "auto",
            },
        ];
        resume.education = [
            {
                id: "edu-1",
                hidden: false,
                institution: "Stanford University",
                area: "Computer Science",
                studyType: "BSc",
                start: "2020-01",
                end: "2023-01",
                location: "California",
                description: "",
                score: "",
                courses: [],
                skills: [],
                url: "",
                urlIcon: "auto",
            },
        ];
        resume.settings.contentSections = ["experience", "education"];
        resume.settings.layout.sectionOrder = ["experience", "pagebreak:test", "education"];
        resume.settings.design.elements = [
            {
                id: "design-text",
                type: "text",
                placement: "overlay",
                pageIndex: 0,
                x: 48,
                y: 48,
                width: 220,
                height: 84,
                zIndex: 1,
                text: "Overlay headline",
                imageSrc: "",
                shape: "rectangle",
                style: {
                    opacity: 85,
                    color: "#112233",
                    backgroundColor: "#ffeeee",
                    fillMode: "solid",
                    gradientFrom: "#ffaa8d",
                    gradientTo: "#ffffff",
                    gradientAngle: 135,
                    fontFamily: "",
                    fontSize: 22,
                    fontWeight: "800",
                    fontStyle: "normal",
                    textDecoration: "none",
                    textTransform: "uppercase",
                    lineHeight: 1.1,
                    letterSpacing: 1,
                    textAlign: "left",
                    objectFit: "cover",
                    paddingTop: 8,
                    paddingBottom: 8,
                    paddingLeft: 10,
                    paddingRight: 10,
                    marginTop: 0,
                    marginBottom: 0,
                    marginLeft: 0,
                    marginRight: 0,
                    border: {
                        style: "solid",
                        width: 1,
                        color: "#112233",
                        radius: 12,
                        top: true,
                        bottom: true,
                        left: true,
                        right: true,
                        dashLength: 6,
                        dashGap: 4,
                    },
                },
            },
            {
                id: "design-gradient",
                type: "gradient",
                placement: "overlay",
                pageIndex: 1,
                x: 64,
                y: 72,
                width: 240,
                height: 140,
                zIndex: 1,
                text: "",
                imageSrc: "",
                shape: "ellipse",
                style: {
                    opacity: 55,
                    color: "#111827",
                    backgroundColor: "",
                    fillMode: "gradient",
                    gradientFrom: "#ffaa8d",
                    gradientTo: "#ffffff",
                    gradientAngle: 120,
                    fontFamily: "",
                    fontSize: 18,
                    fontWeight: "700",
                    fontStyle: "normal",
                    textDecoration: "none",
                    textTransform: "none",
                    lineHeight: 1.2,
                    letterSpacing: 0,
                    textAlign: "left",
                    objectFit: "cover",
                    paddingTop: 0,
                    paddingBottom: 0,
                    paddingLeft: 0,
                    paddingRight: 0,
                    marginTop: 0,
                    marginBottom: 0,
                    marginLeft: 0,
                    marginRight: 0,
                    border: {
                        style: "solid",
                        width: 0,
                        color: "",
                        radius: 0,
                        top: false,
                        bottom: false,
                        left: false,
                        right: false,
                        dashLength: 6,
                        dashGap: 4,
                    },
                },
            },
        ];

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);

        await waitFor(() => {
            expect(container.querySelectorAll(".resume-page")).toHaveLength(2);
            expect(container.querySelector('[data-testid="design-element-design-text"]')).toBeTruthy();
            expect(container.querySelector('[data-testid="design-element-design-gradient"]')).toBeTruthy();
        });

        const pages = container.querySelectorAll(".resume-page");
        const pageOne = pages[0] as HTMLElement;
        const pageTwo = pages[1] as HTMLElement;
        const textOverlay = pageOne.querySelector('[data-testid="design-element-design-text"]') as HTMLElement;
        const gradientOverlay = pageTwo.querySelector('[data-testid="design-element-design-gradient"]') as HTMLElement;

        expect(textOverlay).toHaveTextContent("OVERLAY HEADLINE");
        expect(textOverlay.style.left).toBe("48px");
        expect(textOverlay.style.top).toBe("48px");
        expect(textOverlay.style.width).toBe("220px");
        expect(gradientOverlay.style.left).toBe("64px");
        expect(gradientOverlay.style.height).toBe("140px");
        unmount();
    });

    it("selects, edits, styles, and deselects overlay text directly on the preview", async () => {
        const resume = createEmptyResume();
        const textElement = createDesignElement("text", { pageIndex: 0 });
        textElement.id = "direct-edit-text";
        resume.settings.design.elements = [textElement];

        useResumeStore.setState({
            resume,
            paperSize: "a4",
            selectedDesignElementId: null,
        });

        const { container, unmount } = render(<ResumePreview />);
        const overlay = await waitFor(() => {
            const node = container.querySelector('[data-testid="design-element-direct-edit-text"]') as HTMLElement | null;
            expect(node).toBeTruthy();
            return node!;
        });

        fireEvent.pointerDown(overlay);

        await waitFor(() => {
            expect(useResumeStore.getState().selectedDesignElementId).toBe("direct-edit-text");
            expect(container.querySelector('[data-testid="design-toolbar-direct-edit-text"]')).toBeTruthy();
        });

        fireEvent.doubleClick(overlay);
        const editor = within(overlay).getByRole("textbox", { name: "Overlay text" });
        editor.textContent = "Edited on canvas";
        fireEvent.input(editor);
        fireEvent.blur(editor);

        await waitFor(() => {
            const updated = useResumeStore.getState().resume.settings.design.elements[0];
            expect(updated.text).toBe("Edited on canvas");
        });

        fireEvent.doubleClick(overlay);
        const cancelledEditor = within(overlay).getByRole("textbox", { name: "Overlay text" });
        cancelledEditor.textContent = "Discard this change";
        fireEvent.input(cancelledEditor);
        fireEvent.keyDown(cancelledEditor, { key: "Escape" });

        await waitFor(() => {
            const updated = useResumeStore.getState().resume.settings.design.elements[0];
            expect(updated.text).toBe("Edited on canvas");
            expect(within(overlay).queryByRole("textbox", { name: "Overlay text" })).toBeNull();
        });

        const toolbar = container.querySelector('[data-testid="design-toolbar-direct-edit-text"]') as HTMLElement;
        fireEvent.click(within(toolbar).getByRole("button", { name: "Italic" }));

        await waitFor(() => {
            const updated = useResumeStore.getState().resume.settings.design.elements[0];
            expect(updated.style.fontStyle).toBe("italic");
        });

        const canvas = container.querySelector(".print-exact-scroll-wrapper") as HTMLElement;
        fireEvent.pointerDown(canvas);

        await waitFor(() => {
            expect(useResumeStore.getState().selectedDesignElementId).toBeNull();
            expect(container.querySelector('[data-testid="design-toolbar-direct-edit-text"]')).toBeNull();
            expect(container.querySelector(".enginecv-design-moveable")).toBeNull();
        });

        unmount();
    });

    it("keeps the next section on the current page when a normal summary fits", async () => {
        const raf = installRafController();
        const resume = createSummaryResume();

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);
        applySimpleBlockMeasurements(container, {
            header: 180,
            summary: 140,
            "experience-heading": 48,
            "experience-entry-0": 260,
        });
        await raf.flushAll();

        await waitFor(() => {
            expect(useResumeStore.getState().previewPageCount).toBe(1);
        });

        const page = container.querySelector('[data-testid="resume-preview-page-1"]') as HTMLElement;
        expect(page).toBeTruthy();
        expect(container.querySelectorAll(".resume-page")).toHaveLength(1);
        expect(within(page).getByTestId("resume-preview-summary")).toHaveAttribute("data-summary-layout", "standalone");
        expect(within(page).getByTestId("resume-preview-summary")).toHaveStyle({ marginBottom: "20px" });
        expect(page.querySelector('[data-preview-section-heading="experience"]')).toBeTruthy();
        unmount();
    });

    it("renders the summary as Markdown, keeps its line breaks, and edits it in place", async () => {
        const raf = installRafController();
        const resume = createSummaryResume();
        resume.basics = { ...resume.basics, summary: "Nurse with **6 years** in ICU.\nTrained 8 nurses." };
        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container, unmount } = render(<ResumePreview />);
        applySimpleBlockMeasurements(container, {
            header: 180,
            summary: 140,
            "experience-heading": 48,
            "experience-entry-0": 260,
        });
        await raf.flushAll();

        const page = await waitFor(() => {
            const found = container.querySelector('[data-testid="resume-preview-page-1"]') as HTMLElement;
            expect(within(found).getByTestId("resume-preview-summary")).toBeInTheDocument();
            return found;
        });
        const body = within(page).getByTestId("resume-preview-summary-body");
        expect(body.querySelector("strong")).toHaveTextContent("6 years");
        expect(body.textContent).not.toContain("**");
        expect(body.querySelector("br")).toBeTruthy();

        // Selectable like the name, headline and descriptions: a focusable field that
        // opens the inline editor on double-click.
        const field = body.querySelector("[data-editable-field]") as HTMLElement;
        expect(field).toBeTruthy();
        expect(field).toHaveAttribute("tabindex", "0");
        fireEvent.doubleClick(field);
        await waitFor(() => expect(body.querySelector("[contenteditable='true']")).toBeTruthy());
        unmount();
    });

    it("removes the summary block cleanly when the summary becomes empty", async () => {
        const raf = installRafController();
        const resume = createSummaryResume();

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);
        applySimpleBlockMeasurements(container, {
            header: 180,
            summary: 140,
            "experience-heading": 48,
            "experience-entry-0": 260,
        });
        await raf.flushAll();

        await waitFor(() => {
            expect(within(container.querySelector('[data-testid="resume-preview-page-1"]') as HTMLElement).getByTestId("resume-preview-summary")).toBeInTheDocument();
        });

        useResumeStore.setState((state) => ({
            resume: {
                ...state.resume,
                basics: {
                    ...state.resume.basics,
                    summary: "",
                },
            },
        }));

        await waitFor(() => {
            expect(container.querySelector('[data-testid="resume-preview-measure"] [data-page-block-key="summary"]')).toBeNull();
        });

        applySimpleBlockMeasurements(container, {
            header: 180,
            "experience-heading": 48,
            "experience-entry-0": 260,
        });
        await raf.flushAll();

        await waitFor(() => {
            expect(useResumeStore.getState().previewPageCount).toBe(1);
        });

        const page = container.querySelector('[data-testid="resume-preview-page-1"]') as HTMLElement;
        expect(within(page).queryByTestId("resume-preview-summary")).toBeNull();
        expect(page.querySelector('[data-preview-section-heading="experience"]')).toBeTruthy();
        unmount();
    });

    it("moves following sections only when the structured summary flow exhausts the page", async () => {
        const raf = installRafController();
        const resume = createSummaryResume({
            columns: "two",
            summary: [
                "Built reliable editing systems for multilingual resume workflows.",
                "Protected persistence and pagination trust during complex preview updates.",
            ].join("\n\n"),
        });

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);
        applyStructuredMeasurements(container, {
            "basic:profile": 900,
            "experience:heading": 48,
            "experience:entry:0": 180,
        });
        await raf.flushAll();

        await waitFor(() => {
            expect(container.querySelectorAll(".resume-page")).toHaveLength(2);
        });

        const pageOne = container.querySelector('[data-testid="resume-preview-page-1"]') as HTMLElement;
        const pageTwo = container.querySelector('[data-testid="resume-preview-page-2"]') as HTMLElement;
        expect(within(pageOne).getByTestId("resume-preview-summary")).toHaveAttribute("data-summary-layout", "profile");
        expect(within(pageOne).getByTestId("resume-preview-summary")).toHaveStyle({ marginBottom: "0px" });
        expect(pageOne.querySelector('[data-preview-section-heading="experience"]')).toBeNull();
        expect(pageTwo.querySelector('[data-preview-section-heading="experience"]')).toBeTruthy();
        unmount();
    });

    it("fills the column with a tall section before spilling to the next page", async () => {
        const raf = installRafController();
        const resume = createEmptyResume();
        resume.basics.name = "Column Fill";
        resume.settings.layout.columns = "two";
        resume.settings.layout.leftColumnWidth = 25;
        resume.settings.layout.sectionOrder = ["skills", "projects"];
        resume.settings.layout.sectionPlacement = { skills: "left", projects: "right" };
        resume.skillGroups = [{
            id: "ungrouped",
            name: "",
            hidden: false,
            skills: Array.from({ length: 15 }, (_, i) => ({
                id: `s${i}`,
                hidden: false,
                name: `Skill ${i + 1}`,
                description: "",
                level: "",
                icon: "auto",
                display: "name" as const,
                keywords: [],
            })),
        }];
        resume.projects = Array.from({ length: 17 }, (_, i) => ({
            id: `p${i}`,
            hidden: false,
            name: `Project ${i + 1}`,
            subtitle: "",
            description: "",
            highlights: [],
            keywords: [],
            skills: [],
            start: "",
            end: "",
            url: "",
            urlIcon: "auto",
            repos: [],
            icon: "",
            visibility: "",
        }));

        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container, unmount } = render(<ResumePreview />);
        const projectEntryHeights = Object.fromEntries(
            Array.from({ length: 17 }, (_, i) => [`projects:entry:${i}`, 60]),
        );
        applyStructuredMeasurements(container, {
            "basic:profile": 120,
            "skills:heading": 40,
            "skills:entry:0": 200,
            "projects:heading": 40,
            ...projectEntryHeights,
        });
        await raf.flushAll();

        await waitFor(() => {
            expect(container.querySelectorAll(".resume-page")).toHaveLength(2);
        });

        const pageOne = container.querySelector('[data-testid="resume-preview-page-1"]') as HTMLElement;
        const pageTwo = container.querySelector('[data-testid="resume-preview-page-2"]') as HTMLElement;

        // Skills column stays on page one.
        expect(within(pageOne).getByText("Skill 1")).toBeInTheDocument();
        // The tall projects section starts filling page one instead of jumping
        // wholesale to page two, and only the overflow continues there.
        expect(pageOne.querySelector('[data-preview-section-heading="projects"]')).toBeTruthy();
        expect(within(pageOne).getByText("Project 1")).toBeInTheDocument();
        expect(pageTwo.querySelector('[data-preview-section-heading="projects"]')).toBeNull();
        expect(within(pageTwo).getByText("Project 17")).toBeInTheDocument();
        unmount();
    });

    it("keeps locale-specific summary headings stable in the structured preview flow", async () => {
        const raf = installRafController();
        const resume = createSummaryResume({
            columns: "two",
            language: "de",
            summary: "Erfahrene Ingenieurin mit Fokus auf schnelle, verlässliche Resume-Workflows.",
        });

        useResumeStore.setState({
            resume,
            paperSize: "a4",
        });

        const { container, unmount } = render(<ResumePreview />);
        applyStructuredMeasurements(container, {
            "basic:profile": 520,
            "experience:heading": 48,
            "experience:entry:0": 180,
        });
        await raf.flushAll();

        await waitFor(() => {
            expect(useResumeStore.getState().previewPageCount).toBe(1);
        });

        const page = container.querySelector('[data-testid="resume-preview-page-1"]') as HTMLElement;
        expect(page).toBeTruthy();
        expect(within(page).getByTestId("resume-preview-summary")).toHaveTextContent("Zusammenfassung");
        expect(within(page).getByTestId("resume-preview-summary")).toHaveAttribute("data-summary-layout", "profile");
        expect(page.querySelector('[data-preview-section-heading="experience"]')).toBeTruthy();
        unmount();
    });

    it("page-2 overlap regression: linear chunker honors footer + bottom margin so per-page block sum stays under usable height", async () => {
        const raf = installRafController();
        const resume = createEmptyResume();
        resume.basics.name = "Multi Page";
        resume.experience = Array.from({ length: 6 }, (_, i) => ({
            id: `exp-${i}`,
            hidden: false,
            company: `Company ${i}`,
            position: `Role ${i}`,
            start: "2024-01",
            end: "Present",
            location: "Remote",
            description: `Description for role ${i}`,
            highlights: [],
            skills: [],
            url: "",
            urlIcon: "auto" as const,
        }));
        resume.settings.contentSections = ["experience"];
        resume.settings.layout.columns = "one";
        resume.settings.footer.showPageNumbers = true;
        resume.settings.footer.heightLines = 1;

        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container, unmount } = render(<ResumePreview />);
        await waitFor(() => {
            expect(container.querySelector('[data-testid="resume-preview-measure"]')).toBeTruthy();
        });

        const measureContainer = container.querySelector('[data-testid="resume-preview-measure"]') as HTMLElement;
        const measuredKeys = Array.from(measureContainer.querySelectorAll<HTMLElement>("[data-page-block-key]"))
            .map((node) => node.dataset.pageBlockKey || "");

        const HEADER = 180;
        const HEADING = 48;
        const ENTRY = 280;
        const footprints: Record<string, number> = {};
        measuredKeys.forEach((key) => {
            if (key === "header") footprints[key] = HEADER;
            else if (key.endsWith("-heading")) footprints[key] = HEADING;
            else if (key.includes("-entry-")) footprints[key] = ENTRY;
            else footprints[key] = 40;
        });
        applySimpleBlockMeasurements(container, footprints);
        await raf.flushAll();

        const A4_HEIGHT_PX = 297 * PX_PER_MM;
        const marginVPx = 20 * PX_PER_MM;
        const fontSizePt = resume.settings.typography.fontSize;
        const lineHeight = resume.settings.typography.lineHeight;
        const footerHeightPx = (96 / 72) * fontSizePt * lineHeight * 1;
        const usableHeight = A4_HEIGHT_PX - marginVPx * 2 - footerHeightPx;

        await waitFor(() => {
            expect(useResumeStore.getState().previewPageCount).toBeGreaterThan(1);
        });

        const pages = container.querySelectorAll<HTMLElement>("[data-preview-page]");
        expect(pages.length).toBeGreaterThanOrEqual(2);

        pages.forEach((page) => {
            const blocks = Array.from(page.querySelectorAll<HTMLElement>("[data-page-block-key]"));
            const total = blocks.reduce((acc, block) => {
                const key = block.dataset.pageBlockKey || "";
                return acc + (footprints[key] ?? 0);
            }, 0);
            expect(total).toBeLessThanOrEqual(usableHeight);
        });

        unmount();
    });

    it("repaginates when late font layout increases measured block heights", async () => {
        const raf = installRafController();
        const observers: Array<{
            callback: ResizeObserverCallback;
            targets: Set<Element>;
        }> = [];

        class TestResizeObserver {
            callback: ResizeObserverCallback;
            targets = new Set<Element>();

            constructor(callback: ResizeObserverCallback) {
                this.callback = callback;
                observers.push(this);
            }

            observe(target: Element) {
                this.targets.add(target);
            }

            unobserve(target: Element) {
                this.targets.delete(target);
            }

            disconnect() {
                this.targets.clear();
            }
        }

        globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

        const resume = createEmptyResume();
        resume.basics.name = "Late Font Reflow";
        resume.experience = Array.from({ length: 2 }, (_, index) => ({
            id: `exp-${index}`,
            hidden: false,
            company: `Company ${index + 1}`,
            position: `Role ${index + 1}`,
            start: "2024-01",
            end: "Present",
            location: "Remote",
            description: `Description ${index + 1}`,
            highlights: [],
            skills: [],
            url: "",
            urlIcon: "auto",
        }));
        resume.settings.contentSections = ["experience"];
        resume.settings.layout.columns = "one";
        resume.settings.footer.showPhone = true;
        resume.settings.footer.showEmail = true;
        resume.settings.footer.showPageNumbers = true;

        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container, unmount } = render(<ResumePreview />);
        const measureContainer = container.querySelector('[data-testid="resume-preview-measure"]') as HTMLElement;
        expect(measureContainer).toBeTruthy();

        const applyMeasurements = (lastEntryHeight: number) => {
            applySimpleBlockMeasurements(container, {
                header: 420,
                "experience-heading": 48,
                "experience-entry-0": 230,
                "experience-entry-1": lastEntryHeight,
            });
        };

        applyMeasurements(230);
        await raf.flushAll();
        await waitFor(() => expect(container.querySelectorAll(".resume-page")).toHaveLength(1));

        const paginationObserver = observers.find((observer) => observer.targets.has(measureContainer));
        expect(paginationObserver).toBeTruthy();

        applyMeasurements(280);
        await act(async () => {
            paginationObserver!.callback([], paginationObserver as unknown as ResizeObserver);
            await Promise.resolve();
        });
        await raf.flushAll();

        await waitFor(() => expect(container.querySelectorAll(".resume-page")).toHaveLength(2));
        const pageOne = container.querySelector('[data-testid="resume-preview-page-1"]') as HTMLElement;
        const pageTwo = container.querySelector('[data-testid="resume-preview-page-2"]') as HTMLElement;
        expect(within(pageOne).getByText("Role 1")).toBeInTheDocument();
        expect(within(pageOne).queryByText("Role 2")).toBeNull();
        expect(within(pageTwo).getByText("Role 2")).toBeInTheDocument();

        unmount();
    });

    it("remeasures pagination after entering fullscreen", async () => {
        const raf = installRafController();
        const resume = createEmptyResume();
        resume.basics.name = "Fullscreen Pagination";
        resume.experience = Array.from({ length: 2 }, (_, index) => ({
            id: `fullscreen-exp-${index}`,
            hidden: false,
            company: `Company ${index + 1}`,
            position: `Role ${index + 1}`,
            start: "2024-01",
            end: "Present",
            location: "Remote",
            description: `Description ${index + 1}`,
            highlights: [],
            skills: [],
            url: "",
            urlIcon: "auto",
        }));
        resume.settings.contentSections = ["experience"];
        resume.settings.layout.columns = "one";
        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container, unmount } = render(<ResumePreview />);
        applySimpleBlockMeasurements(container, {
            header: 420,
            "experience-heading": 48,
            "experience-entry-0": 230,
            "experience-entry-1": 230,
        });
        await raf.flushAll();
        await waitFor(() => expect(container.querySelectorAll(".resume-page")).toHaveLength(1));

        fireEvent.click(within(container).getByRole("button", { name: "Fullscreen preview" }));
        applySimpleBlockMeasurements(container, {
            header: 420,
            "experience-heading": 48,
            "experience-entry-0": 230,
            "experience-entry-1": 280,
        });
        await raf.flushAll();

        await waitFor(() => expect(container.querySelectorAll(".resume-page")).toHaveLength(2));
        const pageOne = container.querySelector('[data-testid="resume-preview-page-1"]') as HTMLElement;
        const pageTwo = container.querySelector('[data-testid="resume-preview-page-2"]') as HTMLElement;
        expect(within(pageOne).getByText("Role 1")).toBeInTheDocument();
        expect(within(pageOne).queryByText("Role 2")).toBeNull();
        expect(within(pageTwo).getByText("Role 2")).toBeInTheDocument();

        unmount();
    });

    it("clamps mouse drag offsets so the preview cannot be dragged outside its viewport", async () => {
        const resume = createEmptyResume();
        resume.basics.name = "Bounded Drag";
        useResumeStore.setState({ resume, paperSize: "a4" });

        const { container, unmount } = render(<ResumePreview />);
        await waitFor(() => {
            expect(container.querySelector(".resume-page")).toBeTruthy();
        });

        const previewContainer = container.firstElementChild as HTMLElement;
        const wrapper = container.querySelector(".print-exact-scroll-wrapper") as HTMLElement;
        expect(previewContainer).toBeTruthy();
        expect(wrapper).toBeTruthy();

        const readTranslate = () => {
            const match = /translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/.exec(wrapper.style.transform);
            expect(match).toBeTruthy();
            return { x: parseFloat(match![1]), y: parseFloat(match![2]) };
        };

        const dragBy = (dx: number, dy: number) => {
            fireEvent.mouseDown(previewContainer, { button: 0, clientX: 0, clientY: 0 });
            fireEvent.mouseMove(window, { clientX: dx, clientY: dy });
            fireEvent.mouseUp(window);
        };

        dragBy(100000, 100000);
        const after = readTranslate();
        expect(Math.abs(after.x)).toBeLessThan(2000);
        expect(Math.abs(after.y)).toBeLessThan(2000);

        dragBy(-100000, -100000);
        const afterNeg = readTranslate();
        expect(Math.abs(afterNeg.x)).toBeLessThan(2000);
        expect(Math.abs(afterNeg.y)).toBeLessThan(2000);

        unmount();
    });

    it("resolves section heading, content, and entry overrides in preview output", async () => {
        const resume = createEmptyResume();
        resume.settings.contentSections = ["experience"];
        resume.experience = [{
            id: "exp-local-style",
            hidden: false,
            position: "Engineer",
            company: "EngineCV",
            start: "2024-01",
            end: "",
            location: "",
            description: "Built local-first resume tools.",
            highlights: [],
            skills: [],
            url: "",
            urlIcon: "auto",
        }];
        resume.customization.sectionOverrides.experience = {
            headings: {
                fontSize: 20,
                textAlign: "center",
            },
            contentStyle: {
                backgroundColor: "#ff0000",
            },
            entryLayout: {
                layout: "singleCol",
            },
        };

        const { container } = render(<ResumePreview resumeOverride={resume} paperSizeOverride="a4" />);

        await waitFor(() => {
            const heading = container.querySelector<HTMLElement>(
                '[data-preview-section-heading="experience"] .heading-style',
            );
            expect(heading).not.toBeNull();
            expect(heading?.style.fontSize).toBe("20px");
            expect(heading?.style.textAlign).toBe("center");
        });

        const entries = Array.from(container.querySelectorAll<HTMLElement>('[data-testid="resume-entry"]'));
        expect(entries.length).toBeGreaterThan(0);
        expect(entries.some((entry) => entry.style.backgroundColor === "rgb(255, 0, 0)")).toBe(true);
        expect(entries.some((entry) => entry.style.display === "grid")).toBe(false);
    });

    describe("click-to-navigate menu", () => {
        function renderWithPersonalDetails() {
            const resume = createEmptyResume();
            resume.basics.name = "Jane Doe";
            resume.basics.email = "jane.doe@example.com";
            resume.basics.summary = "Product designer with eight years of experience.";
            resume.settings.contentSections = [];
            useResumeStore.setState({ resume, paperSize: "a4" });
            const { container } = render(<ResumePreview />);
            return container.querySelector(".resume-page") as HTMLElement;
        }

        it("makes the summary a selectable block that belongs to the personal details", async () => {
            const page = renderWithPersonalDetails();

            const summary = await waitFor(() => {
                const node = page.querySelector<HTMLElement>('[data-testid="resume-preview-summary"]');
                expect(node).not.toBeNull();
                return node as HTMLElement;
            });
            // [data-nav-section] is what draws the hover box and opens the menu.
            expect(summary).toHaveAttribute("data-nav-section", "basics");
        });

        it("offers Customize section for personal details and opens that panel", async () => {
            const page = renderWithPersonalDetails();
            const name = await waitFor(() => {
                const node = page.querySelector<HTMLElement>('[data-testid="resume-preview-name"]');
                expect(node).not.toBeNull();
                return node as HTMLElement;
            });

            fireEvent.click(name);
            const customize = await waitFor(() => {
                const button = document.body.querySelector<HTMLButtonElement>("button");
                const match = Array.from(document.body.querySelectorAll<HTMLButtonElement>("button"))
                    .find((candidate) => candidate.textContent?.includes("Customize section"));
                expect(match ?? button).toBeTruthy();
                expect(match).toBeTruthy();
                return match as HTMLButtonElement;
            });

            fireEvent.click(customize);

            const state = useResumeStore.getState();
            expect(state.sidebarTab).toBe("customize");
            expect(state.customizeScope).toBe("resume");
            expect(state.pendingCustomizeNav).toMatchObject({ scope: "resume", panel: "personalDetails" });
        });
    });
});

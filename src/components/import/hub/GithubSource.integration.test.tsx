import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { ImportError, type ImportProvider, type NormalizedProfile, type NormalizedRepository } from "@/lib/import/provider";
import { resumeWith } from "@/lib/import/staging/test-helpers";
import { ImportDataDialog } from "./ImportDataDialog";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

const profile: NormalizedProfile = {
    username: "octocat",
    displayName: "The Octocat",
    bio: "Open-source builder.",
    location: "",
    website: "",
    company: "",
    avatarUrl: "",
    profileUrl: "https://github.com/octocat",
};

const repo = (name: string): NormalizedRepository => ({
    name,
    description: `${name} description.`,
    topics: [],
    stars: 5,
    primaryLanguage: "TypeScript",
    createdAt: "2024-02-15T10:00:00Z",
    pushedAt: "2026-06-20T10:00:00Z",
    isFork: false,
    isArchived: false,
    isPrivate: false,
    url: `https://github.com/octocat/${name}`,
});

function provider(overrides: Partial<ImportProvider> = {}): ImportProvider {
    return {
        name: "github",
        canonicalizeInput: vi.fn((raw: string) => raw.trim() || null),
        fetchProfile: vi.fn(async () => profile),
        fetchRepositories: vi.fn(async () => ({ repos: [repo("engine-cv"), repo("other-tool")], truncated: false })),
        fetchOrganizations: vi.fn(async () => []),
        fetchLanguages: vi.fn(async () => new Map()),
        ...overrides,
    };
}

function open(githubProvider: ImportProvider) {
    render(
        <ImportDataDialog
            current={{ ...resumeWith(), id: "cv-1" }}
            onApply={vi.fn()}
            onCreateNew={vi.fn()}
            onClose={vi.fn()}
            githubProvider={githubProvider}
        />,
    );
}

async function lookUp(user: ReturnType<typeof userEvent.setup>, name = "octocat") {
    await user.click(screen.getByTestId("import-hub-source-github"));
    await user.type(screen.getByTestId("github-import-input"), name);
    await user.click(screen.getByTestId("github-import-submit"));
}

describe("GitHub as a source in the hub", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(cleanup);

    it("makes no request until the person asks, and says so on its own tab", async () => {
        const user = userEvent.setup();
        const fake = provider();
        open(fake);
        // Nothing about GitHub is loaded while another tab is showing.
        expect(screen.queryByTestId("github-import-input")).not.toBeInTheDocument();
        await user.click(screen.getByTestId("import-hub-source-github"));
        expect(screen.getByTestId("import-hub-github")).toHaveTextContent("Contacts GitHub when you ask");
        expect(fake.fetchProfile).not.toHaveBeenCalled();
        expect(fake.fetchRepositories).not.toHaveBeenCalled();
    });

    it("stages the picked repositories as projects beside the other sources", async () => {
        const user = userEvent.setup();
        open(provider());
        await lookUp(user);
        await screen.findByTestId("github-import-repos-section");
        await user.click(screen.getByTestId("github-import-confirm"));

        const batch = await screen.findByTestId("import-hub-batch");
        expect(batch).toHaveTextContent("The Octocat");
        expect(batch).toHaveTextContent("GitHub");
        // The tab keeps a badge for what was added, and nothing was saved.
        expect(screen.getByTestId("import-hub-source-github")).toHaveTextContent("1");
        // The panel starts over instead of spinning on "Building your resume…".
        expect(screen.queryByText("Building your resume…")).not.toBeInTheDocument();
        expect(screen.getByTestId("github-import-input")).toBeInTheDocument();

        await user.click(screen.getByTestId("import-hub-review"));
        const projects = screen.getByTestId("import-hub-section-projects");
        expect(within(projects).getAllByTestId("import-hub-row").length).toBeGreaterThan(0);
        expect(projects).toHaveTextContent("engine-cv");
    });

    it("keeps every group closed and lists the personal details GitHub gives", async () => {
        const user = userEvent.setup();
        open(provider({ fetchProfile: vi.fn(async () => ({ ...profile, email: "octo@example.com", location: "Sarajevo", twitter: "not a handle!" })) }));
        await lookUp(user);
        const details = await screen.findByTestId("github-import-details-section");
        for (const id of ["details", "repos", "organizations", "extras"]) {
            expect(within(screen.getByTestId(`github-import-${id}-section`)).getByRole("button")).toHaveAttribute("aria-expanded", "false");
        }
        expect(screen.queryByTestId("github-import-repo-picker")).not.toBeInTheDocument();

        await user.click(within(details).getByRole("button", { name: /Personal details/ }));
        expect(within(details).getByTestId("github-import-detail-name")).toHaveTextContent("The Octocat");
        expect(within(details).getByTestId("github-import-detail-email")).toHaveTextContent("octo@example.com");
        expect(within(details).getByTestId("github-import-detail-location")).toHaveTextContent("Sarajevo");
        expect(within(details).getByTestId("github-import-detail-summary")).toHaveTextContent("Open-source builder.");
        // Only what the import would write: an invalid handle and empty fields are left out.
        expect(within(details).queryByTestId("github-import-detail-x")).not.toBeInTheDocument();
        expect(within(details).queryByTestId("github-import-detail-website")).not.toBeInTheDocument();
    });

    it("shows a not-found error inside the panel and keeps the other sources", async () => {
        const user = userEvent.setup();
        open(provider({ fetchProfile: vi.fn(async () => { throw new ImportError("not-found"); }) }));
        const file = new File([JSON.stringify({ format: "enginecv.authoring/v1", basics: { name: "Jane Doe" }, experience: [{ company: "Acme", position: "Dev", start: "2020-01" }] })], "ai.json");
        await user.upload(screen.getByTestId("import-hub-file-input"), file);
        await waitFor(() => expect(screen.getAllByTestId("import-hub-batch")).toHaveLength(1));

        await lookUp(user, "missing");
        expect(await screen.findByText(/No GitHub profile found for "missing"/)).toBeInTheDocument();
        expect(screen.getAllByTestId("import-hub-batch")).toHaveLength(1);
        expect(screen.getByRole("dialog", { name: "Import data" })).toBeInTheDocument();
    });

    it("shows a rate-limit error without affecting other sources", async () => {
        const user = userEvent.setup();
        open(provider({ fetchProfile: vi.fn(async () => { throw new ImportError("rate-limited"); }) }));
        await lookUp(user);
        expect(await screen.findByText(/hourly request limit/)).toBeInTheDocument();
        expect(screen.queryByTestId("import-hub-batch")).not.toBeInTheDocument();
    });

    it("reads nothing extra unless asked, and reads and uses it when asked", async () => {
        const user = userEvent.setup();
        const extras = {
            fetchProfileReadme: vi.fn(async () => "I build tools for writers."),
            fetchRepoDetails: vi.fn(async () => new Map([["engine-cv", { summary: "A local-first resume builder that runs in your browser.", stack: ["React"] }]])),
            fetchContributions: vi.fn(async () => [{ repo: "vercel/next.js", url: "https://github.com/vercel/next.js", mergedPrs: 2, titles: ["Fix loader"] }]),
        };

        // Off by default: the plain import never touches them.
        open(provider(extras));
        await lookUp(user);
        await screen.findByTestId("github-import-repos-section");
        await user.click(screen.getByRole("button", { name: /More from GitHub/ }));
        for (const id of ["readme", "details", "contributions"]) expect(screen.getByTestId(`github-import-extra-${id}`)).not.toBeChecked();
        await user.click(screen.getByTestId("github-import-confirm"));
        await screen.findByTestId("import-hub-batch");
        expect(extras.fetchProfileReadme).not.toHaveBeenCalled();
        expect(extras.fetchRepoDetails).not.toHaveBeenCalled();
        expect(extras.fetchContributions).not.toHaveBeenCalled();
        cleanup();

        // Turned on: each is read, and the result reaches the review step.
        open(provider(extras));
        await lookUp(user);
        await screen.findByTestId("github-import-repos-section");
        await user.click(screen.getByRole("button", { name: /More from GitHub/ }));
        await user.click(screen.getByTestId("github-import-extra-readme"));
        await user.click(screen.getByTestId("github-import-extra-details"));
        await user.click(screen.getByTestId("github-import-extra-contributions"));
        await user.click(screen.getByTestId("github-import-confirm"));
        await screen.findByTestId("import-hub-batch");
        expect(extras.fetchProfileReadme).toHaveBeenCalledWith("octocat");
        expect(extras.fetchRepoDetails).toHaveBeenCalledTimes(1);
        expect(extras.fetchContributions).toHaveBeenCalledWith("octocat");
        await user.click(screen.getByTestId("import-hub-review"));
        expect(document.body.textContent).toContain("vercel/next.js");
    });

    it("still imports when an extra cannot be read", async () => {
        const user = userEvent.setup();
        open(provider({ fetchProfileReadme: vi.fn(async () => ""), fetchRepoDetails: vi.fn(async () => new Map()), fetchContributions: vi.fn(async () => []) }));
        await lookUp(user);
        await screen.findByTestId("github-import-repos-section");
        await user.click(screen.getByRole("button", { name: /More from GitHub/ }));
        for (const id of ["readme", "details", "contributions"]) await user.click(screen.getByTestId(`github-import-extra-${id}`));
        await user.click(screen.getByTestId("github-import-confirm"));
        expect(await screen.findByTestId("import-hub-batch")).toHaveTextContent("The Octocat");
    });

    it("shows the lookup only on the GitHub tab", async () => {
        const user = userEvent.setup();
        open(provider());
        await user.click(screen.getByTestId("import-hub-source-github"));
        expect(screen.getByTestId("github-import-input")).toBeInTheDocument();
        await user.click(screen.getByTestId("import-hub-source-enginecv"));
        expect(screen.queryByTestId("github-import-input")).not.toBeInTheDocument();
    });
});

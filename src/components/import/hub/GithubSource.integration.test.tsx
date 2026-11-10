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
    await user.click(screen.getByTestId("import-hub-github-toggle"));
    await user.type(screen.getByTestId("github-import-input"), name);
    await user.click(screen.getByTestId("github-import-submit"));
}

describe("GitHub as a source in the hub", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(cleanup);

    it("makes no request until the person asks", () => {
        const fake = provider();
        open(fake);
        expect(screen.getByTestId("import-hub-github")).toHaveTextContent("Contacts GitHub when you ask");
        expect(screen.queryByTestId("github-import-input")).not.toBeInTheDocument();
        expect(fake.fetchProfile).not.toHaveBeenCalled();
        expect(fake.fetchRepositories).not.toHaveBeenCalled();
    });

    it("stages the picked repositories as projects beside the other sources", async () => {
        const user = userEvent.setup();
        open(provider());
        await lookUp(user);
        await screen.findByTestId("github-import-repo-picker");
        await user.click(screen.getByTestId("github-import-confirm"));

        const batch = await screen.findByTestId("import-hub-batch");
        expect(batch).toHaveTextContent("The Octocat");
        expect(batch).toHaveTextContent("GitHub");
        // The panel closes and nothing was saved.
        expect(screen.queryByTestId("github-import-input")).not.toBeInTheDocument();

        await user.click(screen.getByTestId("import-hub-review"));
        const projects = screen.getByTestId("import-hub-section-projects");
        expect(within(projects).getAllByTestId("import-hub-row").length).toBeGreaterThan(0);
        expect(projects).toHaveTextContent("engine-cv");
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

    it("closes the panel from the toggle", async () => {
        const user = userEvent.setup();
        open(provider());
        await user.click(screen.getByTestId("import-hub-github-toggle"));
        expect(screen.getByTestId("github-import-input")).toBeInTheDocument();
        await user.click(screen.getByTestId("import-hub-github-toggle"));
        expect(screen.queryByTestId("github-import-input")).not.toBeInTheDocument();
    });
});

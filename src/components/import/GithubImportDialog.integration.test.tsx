import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import {
    ImportError,
    type ImportProvider,
    type NormalizedOrganization,
    type NormalizedProfile,
    type NormalizedRepository,
} from "@/lib/import/provider";
import { GithubImportDialog } from "./GithubImportDialog";

const { pushMock } = vi.hoisted(() => ({
    pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: pushMock,
    }),
}));

const profile: NormalizedProfile = {
    username: "octocat",
    displayName: "The Octocat",
    bio: "Open-source builder.",
    location: "San Francisco",
    website: "https://octocat.dev",
    company: "@github",
    avatarUrl: "",
    profileUrl: "https://github.com/octocat",
};

const repos: NormalizedRepository[] = [
    {
        name: "engine-cv",
        description: "Local-first resume builder.",
        topics: ["resume", "typescript"],
        stars: 42,
        primaryLanguage: "TypeScript",
        createdAt: "2024-02-15T10:00:00Z",
        pushedAt: "2026-06-20T10:00:00Z",
        isFork: false,
        isArchived: false,
        isPrivate: false,
        url: "https://github.com/octocat/engine-cv",
    },
    {
        name: "framework-fork",
        description: "Forked framework.",
        topics: ["framework"],
        stars: 4,
        primaryLanguage: "JavaScript",
        createdAt: "2021-01-01T10:00:00Z",
        pushedAt: "2024-01-01T10:00:00Z",
        isFork: true,
        isArchived: false,
        isPrivate: false,
        url: "https://github.com/octocat/framework-fork",
    },
    {
        name: "old-portfolio",
        description: "Archived portfolio.",
        topics: ["portfolio"],
        stars: 2,
        primaryLanguage: "CSS",
        createdAt: "2020-01-01T10:00:00Z",
        pushedAt: "2020-02-01T10:00:00Z",
        isFork: false,
        isArchived: true,
        isPrivate: false,
        url: "https://github.com/octocat/old-portfolio",
    },
];

const organizations: NormalizedOrganization[] = [
    {
        login: "github",
        name: "GitHub",
        description: "Where the world builds software.",
        url: "https://github.com/github",
        avatarUrl: "",
    },
    {
        login: "openjs-foundation",
        name: "OpenJS Foundation",
        description: "JavaScript ecosystem collaboration.",
        url: "https://github.com/openjs-foundation",
        avatarUrl: "",
    },
];

function createProvider(overrides: Partial<ImportProvider> = {}): ImportProvider {
    return {
        name: "github",
        canonicalizeInput: vi.fn((raw: string) => {
            const value = raw.trim();
            return value === "bad input" || value.length === 0 ? null : value;
        }),
        fetchProfile: vi.fn(async () => profile),
        fetchRepositories: vi.fn(async () => ({ repos, truncated: false })),
        fetchOrganizations: vi.fn(async () => []),
        fetchLanguages: vi.fn(async () => new Map([["engine-cv", { TypeScript: 1000 }]])),
        ...overrides,
    };
}

async function openPicker(user: ReturnType<typeof userEvent.setup>, provider: ImportProvider) {
    render(<GithubImportDialog open onClose={vi.fn()} provider={provider} />);
    await user.type(screen.getByTestId("github-import-input"), "octocat");
    await user.click(screen.getByTestId("github-import-submit"));
    await screen.findByTestId("github-import-repo-picker");
}

describe("GithubImportDialog", () => {
    beforeEach(async () => {
        await db.resumes.clear();
        await db.resumeHistory.clear();
        pushMock.mockClear();
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(async () => {
        cleanup();
        await db.resumes.clear();
        await db.resumeHistory.clear();
    });

    it("imports selected GitHub data into a persisted resume and navigates to the editor", async () => {
        const user = userEvent.setup();
        const provider = createProvider();
        const onImported = vi.fn();

        render(<GithubImportDialog open onClose={vi.fn()} provider={provider} onImported={onImported} />);
        await user.type(screen.getByTestId("github-import-input"), "octocat");
        await user.click(screen.getByTestId("github-import-submit"));

        await screen.findByText("engine-cv");
        expect(screen.getByText("framework-fork")).toBeInTheDocument();
        expect(screen.getByTestId("github-import-confirm")).toHaveTextContent("Import 1 repository");
        await user.click(screen.getByTestId("github-import-confirm"));

        await waitFor(() => expect(pushMock).toHaveBeenCalledWith(expect.stringMatching(/^\/editor\//)));
        const resumes = await db.resumes.toArray();
        expect(resumes).toHaveLength(1);
        expect(resumes[0]).toMatchObject({
            basics: {
                name: "The Octocat",
                summary: "Open-source builder.",
                github: "https://github.com/octocat",
            },
            meta: { title: "octocat — GitHub import" },
        });
        expect(resumes[0].projects.map((project) => project.name)).toEqual(["engine-cv"]);
        expect(resumes[0].skillGroups[1].name).toBe("Programming Languages");
        expect(resumes[0].skillGroups[1].skills.map((skill) => skill.name)).toEqual(["TypeScript"]);
        expect(await db.resumeHistory.where("resumeId").equals(resumes[0].id!).count()).toBe(1);
        expect(onImported).toHaveBeenCalledWith(resumes[0].id);
    });

    it("imports selected GitHub organizations as Organisation entries", async () => {
        const user = userEvent.setup();
        const provider = createProvider({
            fetchOrganizations: vi.fn(async () => organizations),
        });

        render(<GithubImportDialog open onClose={vi.fn()} provider={provider} />);
        await user.type(screen.getByTestId("github-import-input"), "octocat");
        await user.click(screen.getByTestId("github-import-submit"));

        await screen.findByTestId("github-import-organization-picker");
        const rows = screen.getAllByTestId("github-import-organization-row");
        expect(within(rows[0]).getByRole("checkbox")).toBeChecked();
        expect(within(rows[1]).getByRole("checkbox")).toBeChecked();
        await user.click(within(rows[1]).getByRole("checkbox"));
        expect(screen.getByTestId("github-import-confirm")).toHaveTextContent(
            "Import 1 repository and 1 organization",
        );
        await user.click(screen.getByTestId("github-import-confirm"));

        await waitFor(() => expect(pushMock).toHaveBeenCalledWith(expect.stringMatching(/^\/editor\//)));
        const [resume] = await db.resumes.toArray();
        expect(provider.fetchOrganizations).toHaveBeenCalledWith("octocat");
        expect(resume.organisations.map((organisation) => [organisation.name, organisation.role, organisation.url])).toEqual([
            ["GitHub", "Member", "https://github.com/github"],
        ]);
        expect(resume.settings.contentSections).toContain("organisations");
    });

    it("rejects invalid input without fetching", async () => {
        const user = userEvent.setup();
        const provider = createProvider();

        render(<GithubImportDialog open onClose={vi.fn()} provider={provider} />);
        await user.type(screen.getByTestId("github-import-input"), "bad input");
        await user.click(screen.getByTestId("github-import-submit"));

        expect(screen.getByTestId("github-import-input-error")).toHaveTextContent(
            "That doesn't look like a GitHub username or profile URL.",
        );
        expect(provider.fetchProfile).not.toHaveBeenCalled();
        expect(provider.fetchRepositories).not.toHaveBeenCalled();
    });

    it("does not persist anything when cancelled before confirmation", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const provider = createProvider();

        render(<GithubImportDialog open onClose={onClose} provider={provider} />);
        await user.click(screen.getByRole("button", { name: "Cancel" }));

        expect(onClose).toHaveBeenCalled();
        expect(await db.resumes.count()).toBe(0);
    });

    it("defaults forks and archived repos unchecked, then supports select-all and clear-all", async () => {
        const user = userEvent.setup();
        const provider = createProvider();

        await openPicker(user, provider);

        const rows = screen.getAllByTestId("github-import-repo-row");
        expect(within(rows[0]).getByRole("checkbox")).toBeChecked();
        expect(within(rows[1]).getByRole("checkbox")).not.toBeChecked();
        expect(within(rows[2]).getByRole("checkbox")).not.toBeChecked();
        expect(screen.getByText("Fork")).toBeInTheDocument();
        expect(screen.getByText("Archived")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Select all" }));
        for (const row of rows) {
            expect(within(row).getByRole("checkbox")).toBeChecked();
        }

        await user.click(screen.getByRole("button", { name: "Clear all" }));
        for (const row of rows) {
            expect(within(row).getByRole("checkbox")).not.toBeChecked();
        }
    });

    it("allows basics-only import when zero repositories are selected", async () => {
        const user = userEvent.setup();
        const provider = createProvider();

        await openPicker(user, provider);
        await user.click(screen.getByRole("button", { name: "Clear all" }));
        expect(screen.getByTestId("github-import-zero-selected-warning")).toHaveTextContent(
            "No repositories or organizations selected",
        );
        await user.click(screen.getByTestId("github-import-confirm"));

        await waitFor(() => expect(pushMock).toHaveBeenCalled());
        const [resume] = await db.resumes.toArray();
        expect(resume.basics.name).toBe("The Octocat");
        expect(resume.projects).toEqual([]);
        expect(resume.skillGroups).toHaveLength(1);
        expect(resume.skillGroups[0].skills).toEqual([]);
    });

    it("shows the empty repository state and still imports basics only", async () => {
        const user = userEvent.setup();
        const provider = createProvider({
            fetchRepositories: vi.fn(async () => ({ repos: [], truncated: false })),
        });

        render(<GithubImportDialog open onClose={vi.fn()} provider={provider} />);
        await user.type(screen.getByTestId("github-import-input"), "octocat");
        await user.click(screen.getByTestId("github-import-submit"));

        expect(await screen.findByTestId("github-import-empty-repos")).toHaveTextContent(
            "This profile has no public repositories.",
        );
        await user.click(screen.getByTestId("github-import-confirm"));

        await waitFor(() => expect(pushMock).toHaveBeenCalled());
        const [resume] = await db.resumes.toArray();
        expect(resume.basics.name).toBe("The Octocat");
        expect(resume.projects).toEqual([]);
        expect(resume.skillGroups).toHaveLength(1);
        expect(resume.skillGroups[0].skills).toEqual([]);
    });

    it("renders translated chrome in Bosnian", () => {
        useI18nStore.setState({ locale: "bs", _hydrated: true });
        render(<GithubImportDialog open onClose={vi.fn()} provider={createProvider()} />);

        expect(screen.getByRole("dialog", { name: "Uvoz sa GitHub-a" })).toBeInTheDocument();
        expect(screen.getByText("GitHub korisničko ime ili URL profila")).toBeInTheDocument();
    });

    it("shows not-found errors and lets the user edit input", async () => {
        const user = userEvent.setup();
        const provider = createProvider({
            fetchProfile: vi.fn(async () => {
                throw new ImportError("not-found");
            }),
        });

        render(<GithubImportDialog open onClose={vi.fn()} provider={provider} />);
        await user.type(screen.getByTestId("github-import-input"), "missing");
        await user.click(screen.getByTestId("github-import-submit"));

        expect(await screen.findByText(/No GitHub profile found for "missing"/)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Back" }));
        expect(screen.getByTestId("github-import-input")).toBeInTheDocument();
    });

    it("renders translated not-found error copy in Bosnian", async () => {
        const user = userEvent.setup();
        useI18nStore.setState({ locale: "bs", _hydrated: true });
        const provider = createProvider({
            fetchProfile: vi.fn(async () => {
                throw new ImportError("not-found");
            }),
        });

        render(<GithubImportDialog open onClose={vi.fn()} provider={provider} />);
        await user.type(screen.getByTestId("github-import-input"), "nema-ga");
        await user.click(screen.getByTestId("github-import-submit"));

        expect(await screen.findByText(/GitHub profil "nema-ga" nije pronađen/)).toBeInTheDocument();
    });

    it("shows rate-limit reset time and waits for manual retry", async () => {
        const user = userEvent.setup();
        const resetAt = new Date("2026-07-07T18:30:00Z");
        const provider = createProvider({
            fetchProfile: vi
                .fn()
                .mockRejectedValueOnce(new ImportError("rate-limited", resetAt))
                .mockResolvedValue(profile),
        });

        render(<GithubImportDialog open onClose={vi.fn()} provider={provider} />);
        await user.type(screen.getByTestId("github-import-input"), "octocat");
        await user.click(screen.getByTestId("github-import-submit"));

        expect(await screen.findByText("GitHub's hourly request limit for your network is used up.")).toBeInTheDocument();
        expect(provider.fetchProfile).toHaveBeenCalledTimes(1);
        await user.click(screen.getByTestId("github-import-retry"));
        await screen.findByTestId("github-import-repo-picker");
        expect(provider.fetchProfile).toHaveBeenCalledTimes(2);
    });

    it("shows a profile preview card after the user pauses typing", async () => {
        const user = userEvent.setup();
        const previewProvider = createProvider();
        const provider = createProvider();

        render(
            <GithubImportDialog open onClose={vi.fn()} provider={provider} previewProvider={previewProvider} />,
        );
        await user.type(screen.getByTestId("github-import-input"), "octocat");
        expect(previewProvider.fetchProfile).not.toHaveBeenCalled();

        const card = await screen.findByTestId("github-profile-preview-card");
        expect(previewProvider.fetchProfile).toHaveBeenCalledWith("octocat");
        expect(within(card).getByText("The Octocat")).toBeInTheDocument();
        expect(within(card).getByText("@octocat")).toBeInTheDocument();
        expect(provider.fetchProfile).not.toHaveBeenCalled();
    });

    it("falls back to the username when the profile has no display name", async () => {
        const user = userEvent.setup();
        const previewProvider = createProvider({
            fetchProfile: vi.fn(async () => ({ ...profile, username: "ghost-user", displayName: "" })),
        });

        render(
            <GithubImportDialog
                open
                onClose={vi.fn()}
                provider={createProvider()}
                previewProvider={previewProvider}
            />,
        );
        await user.type(screen.getByTestId("github-import-input"), "ghost-user");

        const card = await screen.findByTestId("github-profile-preview-card");
        expect(within(card).getByText("ghost-user")).toBeInTheDocument();
        expect(within(card).getByText("@ghost-user")).toBeInTheDocument();
    });

    it("previews the bare username when a profile URL is pasted", async () => {
        const user = userEvent.setup();
        const previewProvider = createProvider();

        render(
            <GithubImportDialog
                open
                onClose={vi.fn()}
                provider={createProvider()}
                previewProvider={previewProvider}
            />,
        );
        await user.click(screen.getByTestId("github-import-input"));
        await user.paste("https://github.com/octocat");

        await screen.findByTestId("github-profile-preview-card");
        expect(previewProvider.fetchProfile).toHaveBeenCalledWith("octocat");
    });

    it("discards a stale preview response when the input has moved on", async () => {
        const user = userEvent.setup();
        let releaseFirst: (value: NormalizedProfile) => void = () => {};
        const firstLookup = new Promise<NormalizedProfile>((resolve) => {
            releaseFirst = resolve;
        });
        const second: NormalizedProfile = { ...profile, username: "octodog", displayName: "The Octodog" };
        const previewProvider = createProvider({
            fetchProfile: vi
                .fn()
                .mockImplementationOnce(() => firstLookup)
                .mockResolvedValue(second),
        });

        render(
            <GithubImportDialog
                open
                onClose={vi.fn()}
                provider={createProvider()}
                previewProvider={previewProvider}
            />,
        );
        const input = screen.getByTestId("github-import-input");
        await user.type(input, "octocat");
        await waitFor(() => expect(previewProvider.fetchProfile).toHaveBeenCalledTimes(1));

        await user.clear(input);
        await user.type(input, "octodog");
        const card = await screen.findByTestId("github-profile-preview-card");
        expect(within(card).getByText("The Octodog")).toBeInTheDocument();

        releaseFirst(profile);
        await waitFor(() => {
            const current = screen.getByTestId("github-profile-preview-card");
            expect(within(current).getByText("The Octodog")).toBeInTheDocument();
            expect(within(current).queryByText("The Octocat")).not.toBeInTheDocument();
        });
    });

    it("keeps the import flow available while a preview is loading and after it resolves", async () => {
        const user = userEvent.setup();
        const previewProvider = createProvider({
            fetchProfile: vi.fn(() => new Promise<NormalizedProfile>(() => {})),
        });
        const provider = createProvider();

        render(
            <GithubImportDialog open onClose={vi.fn()} provider={provider} previewProvider={previewProvider} />,
        );
        await user.type(screen.getByTestId("github-import-input"), "octocat");
        await screen.findByTestId("github-profile-preview-loading");

        expect(screen.getByTestId("github-import-submit")).toBeEnabled();
        await user.click(screen.getByTestId("github-import-submit"));
        await screen.findByTestId("github-import-repo-picker");
        expect(provider.fetchProfile).toHaveBeenCalledWith("octocat");
    });

    it("shows a subtle not-found notice for a nonexistent username without blocking", async () => {
        const user = userEvent.setup();
        const previewProvider = createProvider({
            fetchProfile: vi.fn(async () => {
                throw new ImportError("not-found");
            }),
        });

        render(
            <GithubImportDialog
                open
                onClose={vi.fn()}
                provider={createProvider()}
                previewProvider={previewProvider}
            />,
        );
        await user.type(screen.getByTestId("github-import-input"), "ghost-zzz");

        const notice = await screen.findByTestId("github-profile-preview-not-found");
        expect(notice).toHaveTextContent("No GitHub profile found for that username.");
        // Subtle notice, not the dialog's blocking error step.
        expect(screen.queryByTestId("github-import-retry")).not.toBeInTheDocument();
        expect(screen.getByTestId("github-import-submit")).toBeEnabled();
    });

    it("replaces the not-found notice with a card once the input is corrected", async () => {
        const user = userEvent.setup();
        const previewProvider = createProvider({
            fetchProfile: vi
                .fn()
                .mockRejectedValueOnce(new ImportError("not-found"))
                .mockResolvedValue(profile),
        });

        render(
            <GithubImportDialog
                open
                onClose={vi.fn()}
                provider={createProvider()}
                previewProvider={previewProvider}
            />,
        );
        const input = screen.getByTestId("github-import-input");
        await user.type(input, "octocatt");
        await screen.findByTestId("github-profile-preview-not-found");

        await user.clear(input);
        await user.type(input, "octocat");
        await screen.findByTestId("github-profile-preview-card");
        expect(screen.queryByTestId("github-profile-preview-not-found")).not.toBeInTheDocument();
    });

    it("never looks up input that cannot be a valid username", async () => {
        const user = userEvent.setup();
        const previewProvider = createProvider();

        render(
            <GithubImportDialog
                open
                onClose={vi.fn()}
                provider={createProvider()}
                previewProvider={previewProvider}
            />,
        );
        await user.type(screen.getByTestId("github-import-input"), "-not/valid-");

        // Give the debounce a chance to (wrongly) fire before asserting.
        await new Promise((resolve) => setTimeout(resolve, 700));
        expect(previewProvider.fetchProfile).not.toHaveBeenCalled();
        expect(screen.queryByTestId("github-profile-preview-not-found")).not.toBeInTheDocument();
        expect(screen.queryByTestId("github-profile-preview-card")).not.toBeInTheDocument();
    });

    it("still attempts the import from the not-found preview state", async () => {
        const user = userEvent.setup();
        const previewProvider = createProvider({
            fetchProfile: vi.fn(async () => {
                throw new ImportError("not-found");
            }),
        });
        const provider = createProvider({
            fetchProfile: vi.fn(async () => {
                throw new ImportError("not-found");
            }),
        });

        render(
            <GithubImportDialog open onClose={vi.fn()} provider={provider} previewProvider={previewProvider} />,
        );
        await user.type(screen.getByTestId("github-import-input"), "ghost-zzz");
        await screen.findByTestId("github-profile-preview-not-found");

        await user.click(screen.getByTestId("github-import-submit"));
        expect(await screen.findByText(/No GitHub profile found for "ghost-zzz"/)).toBeInTheDocument();
        expect(provider.fetchProfile).toHaveBeenCalledWith("ghost-zzz");
    });

    it("renders the translated not-found preview notice in Bosnian", async () => {
        const user = userEvent.setup();
        useI18nStore.setState({ locale: "bs", _hydrated: true });
        const previewProvider = createProvider({
            fetchProfile: vi.fn(async () => {
                throw new ImportError("not-found");
            }),
        });

        render(
            <GithubImportDialog
                open
                onClose={vi.fn()}
                provider={createProvider()}
                previewProvider={previewProvider}
            />,
        );
        await user.type(screen.getByTestId("github-import-input"), "nema-ga");

        const notice = await screen.findByTestId("github-profile-preview-not-found");
        expect(notice).toHaveTextContent("GitHub profil s tim korisničkim imenom nije pronađen.");
    });

    it("renders nothing for a rate-limited preview lookup and keeps the import available", async () => {
        const user = userEvent.setup();
        const previewProvider = createProvider({
            fetchProfile: vi.fn(async () => {
                throw new ImportError("rate-limited", new Date("2026-07-08T18:00:00Z"));
            }),
        });
        const provider = createProvider();

        render(
            <GithubImportDialog open onClose={vi.fn()} provider={provider} previewProvider={previewProvider} />,
        );
        await user.type(screen.getByTestId("github-import-input"), "octocat");
        await waitFor(() => expect(previewProvider.fetchProfile).toHaveBeenCalledTimes(1));

        expect(screen.queryByTestId("github-profile-preview-card")).not.toBeInTheDocument();
        expect(screen.queryByTestId("github-profile-preview-not-found")).not.toBeInTheDocument();
        expect(screen.queryByTestId("github-profile-preview-loading")).not.toBeInTheDocument();
        expect(screen.queryByTestId("github-import-retry")).not.toBeInTheDocument();

        await user.click(screen.getByTestId("github-import-submit"));
        await screen.findByTestId("github-import-repo-picker");
    });

    it("renders nothing for a network-failed preview lookup", async () => {
        const user = userEvent.setup();
        const previewProvider = createProvider({
            fetchProfile: vi.fn(async () => {
                throw new ImportError("network");
            }),
        });

        render(
            <GithubImportDialog
                open
                onClose={vi.fn()}
                provider={createProvider()}
                previewProvider={previewProvider}
            />,
        );
        await user.type(screen.getByTestId("github-import-input"), "octocat");
        await waitFor(() => expect(previewProvider.fetchProfile).toHaveBeenCalledTimes(1));

        expect(screen.queryByTestId("github-profile-preview-card")).not.toBeInTheDocument();
        expect(screen.queryByTestId("github-profile-preview-not-found")).not.toBeInTheDocument();
    });

    it("reuses a cached preview result instead of refetching the same username", async () => {
        const user = userEvent.setup();
        const second: NormalizedProfile = { ...profile, username: "octodog", displayName: "The Octodog" };
        const previewProvider = createProvider({
            fetchProfile: vi.fn(async (name: string) => (name === "octodog" ? second : profile)),
        });

        render(
            <GithubImportDialog
                open
                onClose={vi.fn()}
                provider={createProvider()}
                previewProvider={previewProvider}
            />,
        );
        const input = screen.getByTestId("github-import-input");
        await user.type(input, "octocat");
        await screen.findByTestId("github-profile-preview-card");

        await user.clear(input);
        await user.type(input, "octodog");
        await waitFor(() =>
            expect(
                within(screen.getByTestId("github-profile-preview-card")).getByText("The Octodog"),
            ).toBeInTheDocument(),
        );

        await user.clear(input);
        await user.type(input, "octocat");
        await waitFor(() =>
            expect(
                within(screen.getByTestId("github-profile-preview-card")).getByText("The Octocat"),
            ).toBeInTheDocument(),
        );
        expect(previewProvider.fetchProfile).toHaveBeenCalledTimes(2);
    });

    it("re-attempts a lookup after a silent failure for the same username", async () => {
        const user = userEvent.setup();
        const previewProvider = createProvider({
            fetchProfile: vi
                .fn()
                .mockRejectedValueOnce(new ImportError("rate-limited"))
                .mockResolvedValue(profile),
        });

        render(
            <GithubImportDialog
                open
                onClose={vi.fn()}
                provider={createProvider()}
                previewProvider={previewProvider}
            />,
        );
        const input = screen.getByTestId("github-import-input");
        await user.type(input, "octocat");
        await waitFor(() => expect(previewProvider.fetchProfile).toHaveBeenCalledTimes(1));
        expect(screen.queryByTestId("github-profile-preview-card")).not.toBeInTheDocument();

        await user.clear(input);
        await user.type(input, "octocat");
        await screen.findByTestId("github-profile-preview-card");
        expect(previewProvider.fetchProfile).toHaveBeenCalledTimes(2);
    });

    it("stays clean when the dialog closes mid-lookup and is reopened", async () => {
        const user = userEvent.setup();
        let release: (value: NormalizedProfile) => void = () => {};
        const pending = new Promise<NormalizedProfile>((resolve) => {
            release = resolve;
        });
        const previewProvider = createProvider({
            fetchProfile: vi.fn(() => pending),
        });
        const providerProp = createProvider();

        const { rerender } = render(
            <GithubImportDialog open onClose={vi.fn()} provider={providerProp} previewProvider={previewProvider} />,
        );
        await user.type(screen.getByTestId("github-import-input"), "octocat");
        await waitFor(() => expect(previewProvider.fetchProfile).toHaveBeenCalledTimes(1));

        rerender(
            <GithubImportDialog
                open={false}
                onClose={vi.fn()}
                provider={providerProp}
                previewProvider={previewProvider}
            />,
        );
        release(profile);
        await Promise.resolve();

        rerender(
            <GithubImportDialog open onClose={vi.fn()} provider={providerProp} previewProvider={previewProvider} />,
        );
        expect(screen.getByTestId("github-import-input")).toHaveValue("");
        expect(screen.queryByTestId("github-profile-preview-card")).not.toBeInTheDocument();
        expect(screen.queryByTestId("github-profile-preview-loading")).not.toBeInTheDocument();
    });

    it("offers clickable suggestions when the exact lookup misses and search has matches", async () => {
        const user = userEvent.setup();
        const previewProvider = createProvider({
            fetchProfile: vi
                .fn()
                .mockRejectedValueOnce(new ImportError("not-found"))
                .mockResolvedValue({ ...profile, username: "SafetImamovic", displayName: "Safet Imamović" }),
            searchUsers: vi.fn(async () => [
                { login: "SafetImamovic", avatarUrl: "" },
                { login: "safetch", avatarUrl: "" },
            ]),
        });

        render(
            <GithubImportDialog
                open
                onClose={vi.fn()}
                provider={createProvider()}
                previewProvider={previewProvider}
            />,
        );
        const input = screen.getByTestId("github-import-input");
        await user.type(input, "safetimamovik");

        const list = await screen.findByTestId("github-profile-suggestion-list");
        expect(previewProvider.searchUsers).toHaveBeenCalledWith("safetimamovik");
        expect(within(list).getByText("SafetImamovic")).toBeInTheDocument();
        expect(within(list).getByText("safetch")).toBeInTheDocument();
        // Suggestions replace the plain notice.
        expect(screen.queryByTestId("github-profile-preview-not-found")).not.toBeInTheDocument();

        await user.click(within(list).getByText("SafetImamovic"));
        expect(input).toHaveValue("SafetImamovic");
        const card = await screen.findByTestId("github-profile-preview-card");
        expect(within(card).getByText("Safet Imamović")).toBeInTheDocument();
        expect(screen.queryByTestId("github-profile-suggestion-list")).not.toBeInTheDocument();
    });

    it("keeps the plain not-found notice when the suggestion search returns nothing", async () => {
        const user = userEvent.setup();
        const previewProvider = createProvider({
            fetchProfile: vi.fn(async () => {
                throw new ImportError("not-found");
            }),
            searchUsers: vi.fn(async () => []),
        });

        render(
            <GithubImportDialog
                open
                onClose={vi.fn()}
                provider={createProvider()}
                previewProvider={previewProvider}
            />,
        );
        await user.type(screen.getByTestId("github-import-input"), "zzz-nobody");

        await screen.findByTestId("github-profile-preview-not-found");
        await waitFor(() => expect(previewProvider.searchUsers).toHaveBeenCalledTimes(1));
        expect(screen.queryByTestId("github-profile-suggestion-list")).not.toBeInTheDocument();
    });

    it("keeps the plain not-found notice when the suggestion search fails", async () => {
        const user = userEvent.setup();
        const previewProvider = createProvider({
            fetchProfile: vi.fn(async () => {
                throw new ImportError("not-found");
            }),
            searchUsers: vi.fn(async () => {
                throw new ImportError("rate-limited");
            }),
        });

        render(
            <GithubImportDialog
                open
                onClose={vi.fn()}
                provider={createProvider()}
                previewProvider={previewProvider}
            />,
        );
        await user.type(screen.getByTestId("github-import-input"), "zzz-nobody");

        await screen.findByTestId("github-profile-preview-not-found");
        await waitFor(() => expect(previewProvider.searchUsers).toHaveBeenCalledTimes(1));
        expect(screen.queryByTestId("github-profile-suggestion-list")).not.toBeInTheDocument();
        expect(screen.queryByTestId("github-import-retry")).not.toBeInTheDocument();
    });

    it("hides suggestions as soon as the input changes", async () => {
        const user = userEvent.setup();
        const previewProvider = createProvider({
            fetchProfile: vi.fn(async () => {
                throw new ImportError("not-found");
            }),
            searchUsers: vi.fn(async () => [{ login: "SafetImamovic", avatarUrl: "" }]),
        });

        render(
            <GithubImportDialog
                open
                onClose={vi.fn()}
                provider={createProvider()}
                previewProvider={previewProvider}
            />,
        );
        const input = screen.getByTestId("github-import-input");
        await user.type(input, "safetimamovik");
        await screen.findByTestId("github-profile-suggestion-list");

        await user.type(input, "x");
        expect(screen.queryByTestId("github-profile-suggestion-list")).not.toBeInTheDocument();
    });

    it("skips the suggestion flow entirely when the preview provider has no search surface", async () => {
        const user = userEvent.setup();
        const previewProvider = createProvider({
            fetchProfile: vi.fn(async () => {
                throw new ImportError("not-found");
            }),
        });

        render(
            <GithubImportDialog
                open
                onClose={vi.fn()}
                provider={createProvider()}
                previewProvider={previewProvider}
            />,
        );
        await user.type(screen.getByTestId("github-import-input"), "zzz-nobody");

        await screen.findByTestId("github-profile-preview-not-found");
        expect(screen.queryByTestId("github-profile-suggestion-list")).not.toBeInTheDocument();
    });

    it("renders the translated did-you-mean heading in Bosnian", async () => {
        const user = userEvent.setup();
        useI18nStore.setState({ locale: "bs", _hydrated: true });
        const previewProvider = createProvider({
            fetchProfile: vi.fn(async () => {
                throw new ImportError("not-found");
            }),
            searchUsers: vi.fn(async () => [{ login: "SafetImamovic", avatarUrl: "" }]),
        });

        render(
            <GithubImportDialog
                open
                onClose={vi.fn()}
                provider={createProvider()}
                previewProvider={previewProvider}
            />,
        );
        await user.type(screen.getByTestId("github-import-input"), "safetimamovik");

        const list = await screen.findByTestId("github-profile-suggestion-list");
        expect(within(list).getByText("Nema tačnog podudaranja. Da li ste mislili:")).toBeInTheDocument();
    });

    it("retries a repository fetch without refetching the profile", async () => {
        const user = userEvent.setup();
        const provider = createProvider({
            fetchRepositories: vi
                .fn()
                .mockRejectedValueOnce(new ImportError("network"))
                .mockResolvedValue({ repos, truncated: false }),
        });

        render(<GithubImportDialog open onClose={vi.fn()} provider={provider} />);
        await user.type(screen.getByTestId("github-import-input"), "octocat");
        await user.click(screen.getByTestId("github-import-submit"));

        expect(await screen.findByText("Couldn't reach GitHub. Check your connection and retry.")).toBeInTheDocument();
        await user.click(screen.getByTestId("github-import-retry"));
        await screen.findByTestId("github-import-repo-picker");
        expect(provider.fetchProfile).toHaveBeenCalledTimes(1);
        expect(provider.fetchRepositories).toHaveBeenCalledTimes(2);
    });
});

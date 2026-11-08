import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { ImportError, type ImportProvider, type NormalizedProfile } from "@/lib/import/provider";
import { GithubImportPanel } from "./GithubImportPanel";

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

function createProvider(overrides: Partial<ImportProvider> = {}): ImportProvider {
    return {
        name: "github",
        canonicalizeInput: vi.fn((raw: string) => raw.trim() || null),
        fetchProfile: vi.fn(async () => profile),
        fetchRepositories: vi.fn(async () => ({ repos: [], truncated: false })),
        fetchOrganizations: vi.fn(async () => []),
        fetchLanguages: vi.fn(async () => new Map()),
        ...overrides,
    };
}

async function submit(user: ReturnType<typeof userEvent.setup>, username: string) {
    await user.type(screen.getByTestId("github-import-input"), username);
    await user.click(screen.getByTestId("github-import-submit"));
}

// The dialog tests cover the flow in depth; these cover the panel standing on a page.
describe("GithubImportPanel on a page", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(cleanup);

    it("renders without dialog chrome and without a cancel button on the first step", () => {
        render(
            <>
                <h1 id="page-title">GitHub to CV</h1>
                <GithubImportPanel onDone={vi.fn()} labelledBy="page-title" provider={createProvider()} />
            </>,
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByRole("region", { name: "GitHub to CV" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    });

    it("names a user that does not exist and lets the visitor correct it", async () => {
        const user = userEvent.setup();
        const provider = createProvider({
            fetchProfile: vi.fn(async () => {
                throw new ImportError("not-found");
            }),
        });
        render(<GithubImportPanel onDone={vi.fn()} provider={provider} />);

        await submit(user, "nobody-here");
        expect(await screen.findByText(/nobody-here/)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Back" }));
        expect(screen.getByTestId("github-import-input")).toBeInTheDocument();
    });

    it("retries after a network error and then saves, handing the id to the host", async () => {
        const user = userEvent.setup();
        const fetchProfile = vi.fn()
            .mockRejectedValueOnce(new ImportError("network"))
            .mockResolvedValue(profile);
        const onDone = vi.fn();
        const persistResume = vi.fn().mockResolvedValue("resume-3");
        render(<GithubImportPanel onDone={onDone} provider={createProvider({ fetchProfile })} persistResume={persistResume} />);

        await submit(user, "octocat");
        await user.click(await screen.findByTestId("github-import-retry"));
        await user.click(await screen.findByTestId("github-import-confirm"));

        await waitFor(() => expect(onDone).toHaveBeenCalledWith("resume-3"));
        expect(persistResume.mock.calls[0][0].basics.name).toBe("The Octocat");
    });
});

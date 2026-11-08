import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockGithubFetch, makeRawRepo, type MockRoute } from "@/lib/import/__fixtures__/mockGithubFetch";
import { createGithubProvider } from "@/lib/import/github";
import { projectSchema, type Resume } from "@/lib/schema";
import { GithubProjectsImportDialog } from "./GithubProjectsImportDialog";

function setup(routes: MockRoute[], existingProjects: Resume["projects"] = []) {
    const mock = createMockGithubFetch(routes);
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
        <GithubProjectsImportDialog
            existingProjects={existingProjects}
            onApply={onApply}
            onClose={onClose}
            createProvider={() => createGithubProvider(mock.fetch)}
        />,
    );
    return { mock, onApply, onClose };
}

function find(query: string) {
    fireEvent.change(screen.getByTestId("github-projects-input"), { target: { value: query } });
    fireEvent.click(screen.getByTestId("github-projects-find"));
}

const repoRoutes: MockRoute[] = [
    { match: /\/repos\/octocat\/hello-world$/, body: makeRawRepo({ name: "hello-world", html_url: "https://github.com/octocat/hello-world" }) },
    { match: /\/repos\/octocat\/hello-world\/languages$/, body: { Go: 900, Makefile: 10 } },
];

describe("GithubProjectsImportDialog", () => {
    afterEach(() => cleanup());

    it("says requests go from the browser to GitHub and only public repos are visible", () => {
        setup([]);
        const notice = screen.getByTestId("github-projects-network-notice");
        expect(notice).toHaveTextContent("api.github.com");
        expect(notice).toHaveTextContent("only public repositories");
    });

    it("adds a repository named by URL to the existing projects", async () => {
        const existing = [projectSchema.parse({ id: "mine", name: "Hand-written", description: "kept" })];
        const { onApply, onClose, mock } = setup(repoRoutes, existing);

        find("https://github.com/octocat/hello-world");
        await waitFor(() => expect(screen.getByTestId("github-projects-add")).toBeEnabled());
        fireEvent.click(screen.getByTestId("github-projects-add"));

        await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
        const projects = onApply.mock.calls[0][0] as Resume["projects"];
        expect(projects.map((project) => project.name)).toEqual(["Hand-written", "hello-world"]);
        expect(projects[0]).toBe(existing[0]);
        expect(projects[1].skills).toEqual(["Go", "Makefile"]);
        expect(onClose).toHaveBeenCalled();
        expect(mock.calls().every((url) => url.startsWith("https://api.github.com/"))).toBe(true);
    });

    it("lists a profile's repositories without preselecting and hides ones already on the CV", async () => {
        const { onApply } = setup(
            [
                {
                    match: /\/users\/octocat\/repos/,
                    body: [
                        makeRawRepo({ name: "alpha", html_url: "https://github.com/octocat/alpha" }),
                        makeRawRepo({ name: "beta", html_url: "https://github.com/octocat/beta" }),
                    ],
                },
                { match: /\/languages$/, body: {} },
            ],
            [projectSchema.parse({ id: "b", name: "beta", url: "https://github.com/octocat/beta" })],
        );

        find("octocat");
        expect(await screen.findByTestId("github-projects-already-added")).toHaveTextContent("1 repository is already on this CV");
        expect(screen.getByTestId("github-projects-add")).toBeDisabled();
        expect(screen.queryByText("beta", { selector: "span,p,label" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByText("alpha"));
        fireEvent.click(screen.getByTestId("github-projects-add"));
        await waitFor(() => expect(onApply).toHaveBeenCalled());
        expect((onApply.mock.calls[0][0] as Resume["projects"]).map((project) => project.name)).toEqual(["beta", "alpha"]);
    });

    it("rejects input that names neither a repository nor a user", () => {
        const { mock } = setup([]);
        find("https://gitlab.com/a/b");
        expect(screen.getByTestId("github-projects-error")).toHaveTextContent("Enter a repository URL");
        expect(mock.calls()).toEqual([]);
    });

    it("reports a missing repository", async () => {
        setup([{ match: /\/repos\//, status: 404, body: {} }]);
        find("octocat/nope");
        expect(await screen.findByTestId("github-projects-error")).toHaveTextContent('no public repository or profile called "octocat/nope"');
    });
});

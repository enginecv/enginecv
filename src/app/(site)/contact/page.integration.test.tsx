import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTACT_EMAILS, FEEDBACK_ISSUES_URL, FEEDBACK_REPO_URL } from "@/lib/contact";
import ContactPage from "./page";

vi.mock("next/navigation", () => ({
    usePathname: () => "/contact",
    useRouter: () => ({ prefetch: vi.fn() }),
}));

describe("ContactPage", () => {
    afterEach(() => {
        cleanup();
    });

    it("renders the public contact channels and feedback repo", () => {
        render(<ContactPage />);

        expect(screen.getByRole("heading", { name: "Contact EngineCV" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /hello@enginecv\.app/i })).toHaveAttribute(
            "href",
            expect.stringContaining(`mailto:${CONTACT_EMAILS.hello}`),
        );
        expect(screen.getAllByRole("link", { name: /support@enginecv\.app/i })[0]).toHaveAttribute(
            "href",
            expect.stringContaining(`mailto:${CONTACT_EMAILS.support}`),
        );
        expect(screen.getAllByRole("link", { name: /safet@enginecv\.app/i })[0]).toHaveAttribute(
            "href",
            expect.stringContaining(`mailto:${CONTACT_EMAILS.founder}`),
        );
        expect(screen.getByRole("link", { name: /jobs@enginecv\.app/i })).toHaveAttribute(
            "href",
            expect.stringContaining(`mailto:${CONTACT_EMAILS.jobs}`),
        );
        expect(screen.getByRole("link", { name: "Open GitHub issues" })).toHaveAttribute(
            "href",
            FEEDBACK_ISSUES_URL,
        );
        expect(screen.getByRole("link", { name: "View feedback repo" })).toHaveAttribute(
            "href",
            FEEDBACK_REPO_URL,
        );
    });

    it("sets clear response expectations", () => {
        render(<ContactPage />);

        expect(screen.getByRole("heading", { name: "Response expectations" })).toBeInTheDocument();
        expect(screen.getByText(/1-2 business days/i)).toBeInTheDocument();
        expect(screen.getByText(/Do not post private resume content/i)).toBeInTheDocument();
    });
});

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTHORING_SCHEMA_URL } from "@/lib/agent/authoring/schema";
import { SKILL_URL } from "@/lib/agent/authoring/skill-urls";
import { PUBLIC_ROUTES } from "@/lib/site";
import PrivacyPage from "../privacy/page";
import CookiesPage from "../cookies/page";
import LinkedFilesPage from "./page";

vi.mock("next/navigation", () => ({
    usePathname: () => "/linked-files",
    useRouter: () => ({ prefetch: vi.fn() }),
}));

afterEach(cleanup);

const main = () => within(screen.getByRole("main"));

describe("linked files technical page", () => {
    it("is a public route", () => {
        expect(PUBLIC_ROUTES).toContain("/linked-files");
    });

    it("explains storage, syncing, errors, the skill and the limits, and links the skill and schema", () => {
        render(<LinkedFilesPage />);
        expect(screen.getByRole("heading", { level: 1, name: "How linked files work" })).toBeInTheDocument();
        for (const heading of [/What is stored where/, /How a change is noticed/, /When something goes wrong/, /The agent skill/, /Browser support and limits/, /Privacy and security/]) {
            expect(main().getByRole("heading", { name: heading })).toBeInTheDocument();
        }
        expect(main().getByRole("link", { name: SKILL_URL })).toHaveAttribute("href", SKILL_URL);
        expect(main().getByRole("link", { name: AUTHORING_SCHEMA_URL })).toHaveAttribute("href", AUTHORING_SCHEMA_URL);
        expect(main().getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
        expect(main().getByRole("link", { name: "Your data" })).toHaveAttribute("href", "/your-data");
    });
});

describe("policy pages mention linked files", () => {
    it("the privacy policy has a linked files section, says the file is not deleted, and keeps its cross references right", () => {
        render(<PrivacyPage />);
        const section = main().getByRole("heading", { name: "5. Linked files and AI agents" }).closest("section")!;
        expect(section).toHaveTextContent("model provider");
        expect(section).toHaveTextContent("do not delete it");
        expect(within(section).getByRole("link", { name: "How linked files work" })).toHaveAttribute("href", "/linked-files");
        // Sections that others refer to by number.
        expect(main().getByRole("heading", { name: "6. Advertising and consent" })).toBeInTheDocument();
        expect(main().getByRole("heading", { name: "8. Hosting" })).toBeInTheDocument();
        expect(main().getByText(/hosting provider \(section 8\)/)).toBeInTheDocument();
        expect(main().getByText(/See section 6\./)).toBeInTheDocument();
    });

    it("the cookie policy lists the linkedFiles table and explains the file permission", () => {
        render(<CookiesPage />);
        expect(within(screen.getByTestId("cookie-policy-storage")).getByText("linkedFiles")).toBeInTheDocument();
        expect(main().getByRole("link", { name: "how linked files work" })).toHaveAttribute("href", "/linked-files");
    });
});

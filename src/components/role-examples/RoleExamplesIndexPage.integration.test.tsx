import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { translate } from "@/lib/i18n/translate";

vi.mock("next/navigation", () => ({
    usePathname: () => "/",
    useRouter: () => ({ prefetch: vi.fn(), push: vi.fn() }),
    notFound: () => {
        throw new Error("NEXT_NOT_FOUND");
    },
}));

// The page chrome (navbar, footer) is covered elsewhere.
vi.mock("@/components/templates/gallery/GalleryPage", () => ({
    GalleryPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const { RoleExamplesIndexPage, roleExamplesIndexMetadata } = await import("./RoleExamplesIndexPage");

describe("English index", () => {
    afterEach(cleanup);

    it("lists published roles grouped by field, each linking to its page", () => {
        render(<RoleExamplesIndexPage locale="en" />);

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(translate("en", "roleExamples.indexTitle"));
        // Group headings only: the page also ends with the English how-to-use guide, which has its own h2.
        const groups = screen.getAllByTestId(/^role-group-/).map((section) => section.querySelector("h2")?.textContent);
        expect(groups).toEqual([translate("en", "roleExamples.group.tech"), translate("en", "roleExamples.group.care")]);
        expect(screen.getByTestId("index-guide")).toBeInTheDocument();

        const cards = screen.getAllByTestId("role-example-card");
        expect(cards.map((card) => card.getAttribute("data-role"))).toEqual([
            "software-developer",
            "frontend-developer",
            "backend-developer",
            "devops-engineer",
            "data-analyst",
            "qa-tester",
            "it-support",
            "nurse",
        ]);
        expect(within(cards[7]).getByRole("link", { name: "Nurse" })).toHaveAttribute("href", "/cv-examples/nurse");
    });

    it("does not list the German drafts", () => {
        render(<RoleExamplesIndexPage locale="en" />);
        expect(screen.queryByRole("link", { name: "Pflegefachkraft" })).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Softwareentwickler" })).not.toBeInTheDocument();
    });

    it("has a canonical and no hreflang while only English has an index", () => {
        const metadata = roleExamplesIndexMetadata("en");
        expect(metadata.alternates?.canonical).toBe("/cv-examples");
        expect(metadata.alternates?.languages).toBeUndefined();
    });
});

describe("languages without published examples", () => {
    it("404 instead of showing an empty index or another language's", () => {
        expect(() => RoleExamplesIndexPage({ locale: "de" })).toThrow("NEXT_NOT_FOUND");
        expect(() => RoleExamplesIndexPage({ locale: "fr" })).toThrow("NEXT_NOT_FOUND");
        expect(() => RoleExamplesIndexPage({ locale: "bs" })).toThrow("NEXT_NOT_FOUND");
    });
});

describe("once the German version is published", () => {
    afterEach(() => {
        cleanup();
        vi.doUnmock("@/lib/role-examples/registry");
        vi.resetModules();
    });

    it("lists it in German and declares hreflang between the two indexes", async () => {
        vi.resetModules();
        vi.doMock("@/lib/role-examples/registry", async (importOriginal) => {
            const actual = await importOriginal<typeof import("@/lib/role-examples/registry")>();
            return {
                ...actual,
                ROLE_EXAMPLES: actual.ROLE_EXAMPLES.map((role) => role.id === "nurse"
                    ? { ...role, versions: { ...role.versions, de: { ...role.versions.de!, status: "published" as const } } }
                    : role),
            };
        });
        const fresh = await import("./RoleExamplesIndexPage");

        render(<fresh.RoleExamplesIndexPage locale="de" />);
        expect(screen.getByRole("link", { name: "Pflegefachkraft" })).toHaveAttribute("href", "/de/cv-examples/pflegefachkraft");
        expect(screen.getAllByTestId("role-example-card")).toHaveLength(1);
        // The German software role is still a draft.
        expect(screen.queryByRole("link", { name: "Softwareentwickler" })).not.toBeInTheDocument();

        expect(fresh.roleExamplesIndexMetadata("de").alternates?.languages).toEqual({
            en: "/cv-examples",
            de: "/de/cv-examples",
            "x-default": "/cv-examples",
        });
    });
});

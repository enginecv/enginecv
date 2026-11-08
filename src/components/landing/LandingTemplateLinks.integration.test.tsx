import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { Navbar } from "./Navbar";

vi.mock("next/navigation", () => ({
    usePathname: () => "/",
    useRouter: () => ({
        push: vi.fn(),
    }),
}));

const TEMPLATES_HREF = "/cv-templates";

describe("landing template links", () => {
    afterEach(() => {
        cleanup();
    });

    it("routes the hero templates CTA to the public template gallery", () => {
        const { container } = render(<Hero />);

        const link = container.querySelector(`a[href="${TEMPLATES_HREF}"]`);
        expect(link).not.toBeNull();
    });

    it("routes the navbar Templates link to the public template gallery", () => {
        const { container } = render(<Navbar />);

        expect(container.querySelector(`a[href="${TEMPLATES_HREF}"]`)).toHaveTextContent("Templates");
    });

    it("routes the footer Templates link to the public template gallery", () => {
        render(<Footer />);

        expect(screen.getByRole("link", { name: "Templates" })).toHaveAttribute("href", TEMPLATES_HREF);
    });
});

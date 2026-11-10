import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { GUIDE_REGISTRY } from "@/lib/guides/registry";
import { GetTipsLink } from "./GetTipsLink";

describe("GetTipsLink", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(() => {
        cleanup();
    });

    it("opens the published guide for the section in a new tab", () => {
        const published = GUIDE_REGISTRY.find((entry) => entry.published && entry.sectionId);
        expect(published, "at least one published guide mapped to a section").toBeDefined();

        render(<GetTipsLink sectionId={published!.sectionId!} className="bg-surface-4" />);

        const link = screen.getByRole("link", { name: "Get Tips" });
        expect(link).toHaveAttribute("href", `/guides/${published!.slug}`);
        expect(link).toHaveAttribute("target", "_blank");
        expect(link.getAttribute("rel")).toContain("noopener");
    });

    it("renders nothing for a section whose guide is not published", () => {
        const unpublished = GUIDE_REGISTRY.find((entry) => !entry.published && entry.sectionId);
        expect(unpublished, "at least one unpublished guide mapped to a section").toBeDefined();

        const { container } = render(<GetTipsLink sectionId={unpublished!.sectionId!} className="" />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing for sections that never have a guide", () => {
        for (const sectionId of ["basics", "interests", "declaration", "custom"]) {
            const { container } = render(<GetTipsLink sectionId={sectionId} className="" />);
            expect(container).toBeEmptyDOMElement();
            cleanup();
        }
    });

    it("keeps the translated label", () => {
        useI18nStore.setState({ locale: "de", _hydrated: true });
        const published = GUIDE_REGISTRY.find((entry) => entry.published && entry.sectionId)!;

        render(<GetTipsLink sectionId={published.sectionId!} className="" />);
        expect(screen.getByTestId("get-tips-link")).not.toHaveTextContent("Get Tips");
    });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getGalleryTemplates } from "@/lib/templates/gallery";
import { TemplateDeepDive } from "./TemplateDeepDive";

describe("TemplateDeepDive", () => {
    it("renders all four sections for every template in English", () => {
        for (const { slug } of getGalleryTemplates()) {
            const { unmount } = render(<TemplateDeepDive locale="en" slug={slug} />);
            expect(screen.getByTestId("template-deep-dive")).toBeInTheDocument();
            expect(screen.getByRole("heading", { name: "About this template" })).toBeInTheDocument();
            expect(screen.getByRole("heading", { name: "How it is built" })).toBeInTheDocument();
            expect(screen.getByRole("heading", { name: "Getting the most out of it" })).toBeInTheDocument();
            expect(screen.getByRole("heading", { name: "When another template fits better" })).toBeInTheDocument();
            unmount();
        }
    });

    it("renders nothing outside English or for an unknown slug", () => {
        const { container, rerender } = render(<TemplateDeepDive locale="de" slug="modern" />);
        expect(container).toBeEmptyDOMElement();
        rerender(<TemplateDeepDive locale="en" slug="does-not-exist" />);
        expect(container).toBeEmptyDOMElement();
    });
});

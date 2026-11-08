import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { ProductStory } from "./ProductStory";

describe("ProductStory", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(() => {
        cleanup();
    });

    it("shows real sample data in the editor visual", () => {
        render(<ProductStory />);

        expect(screen.getByTestId("landing-story-sample-name")).toHaveTextContent("NameAlex Carter");
        expect(screen.getByTestId("landing-story-sample-headline")).toHaveTextContent(
            "HeadlineSenior Product Designer",
        );
        expect(screen.getByTestId("landing-story-sample-summary")).toHaveTextContent(
            "SummaryAccessible products and scalable design systems.",
        );
    });

    it("uses the neutral surface palette for the preview pane", () => {
        render(<ProductStory />);

        expect(screen.getByTestId("landing-story-preview-pane")).toHaveClass("bg-surface-2");
        expect(screen.getByTestId("landing-story-preview-pane").className).not.toContain("bg-[#");
    });

    it("enlarges the resume document without sacrificing its mobile fit", () => {
        render(<ProductStory />);

        expect(screen.getByTestId("landing-story-editor-visual")).toHaveClass(
            "grid-cols-1",
            "sm:grid-cols-[0.75fr_1.25fr]",
        );
        expect(screen.getByTestId("landing-story-preview-document")).toHaveClass(
            "w-24",
            "sm:w-32",
            "lg:w-40",
        );
    });
});

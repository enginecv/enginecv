import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { countWords } from "@/lib/content-depth/word-count";
import { INDEX_GUIDES, type IndexGuideId } from "@/lib/index-guides";
import { IndexGuide } from "./IndexGuide";

const IDS: IndexGuideId[] = ["examples", "templates", "tools"];

describe("IndexGuide", () => {
    afterEach(cleanup);

    it.each(IDS)("renders the %s guide in English with its heading", (id) => {
        render(<IndexGuide locale="en" id={id} />);
        expect(screen.getByTestId("index-guide")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: INDEX_GUIDES[id].heading })).toBeInTheDocument();
    });

    it.each(IDS)("renders nothing outside English for %s", (id) => {
        const { container } = render(<IndexGuide locale="de" id={id} />);
        expect(container).toBeEmptyDOMElement();
    });

    it.each(IDS)("keeps the %s guide between 150 and 350 words", (id) => {
        const words = countWords(INDEX_GUIDES[id].paragraphs.join("\n\n"));
        expect(words).toBeGreaterThanOrEqual(150);
        expect(words).toBeLessThanOrEqual(350);
    });
});

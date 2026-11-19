import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { CvChoiceGrid, type CvChoice } from "./CvChoiceGrid";

const make = (count: number): CvChoice[] => Array.from({ length: count }, (_, index) => ({ id: `cv-${index}`, label: `CV ${index}`, detail: index === 0 ? "Designer" : undefined }));

function Harness({ choices }: { choices: CvChoice[] }) {
    const [value, setValue] = useState(choices[0].id);
    return <CvChoiceGrid choices={choices} value={value} onChange={setValue} name="t" testIdPrefix="pick" />;
}

describe("CvChoiceGrid", () => {
    afterEach(cleanup);

    it("shows every CV as a card and marks the chosen one", () => {
        render(<Harness choices={make(3)} />);
        const radios = screen.getAllByRole("radio");
        expect(radios).toHaveLength(3);
        expect(radios[0]).toBeChecked();
        expect(screen.getByText("Designer")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("pick-option-cv-2"));
        expect(screen.getAllByRole("radio")[2]).toBeChecked();
    });

    it("offers search only when there are many CVs, and says when nothing matches", () => {
        const { unmount } = render(<Harness choices={make(3)} />);
        expect(screen.queryByTestId("pick-search")).toBeNull();
        unmount();

        render(<Harness choices={make(8)} />);
        fireEvent.change(screen.getByTestId("pick-search"), { target: { value: "CV 7" } });
        expect(screen.getAllByRole("radio")).toHaveLength(1);
        fireEvent.change(screen.getByTestId("pick-search"), { target: { value: "zzz" } });
        expect(screen.getByTestId("pick-no-match")).toBeInTheDocument();
    });
});

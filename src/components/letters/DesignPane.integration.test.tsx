import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { DEFAULT_LETTER_DESIGN, applyDesignOverrides } from "@/lib/letters/design";
import { type LetterDocument } from "@/lib/letters/schema";
import { makeLetter } from "../../../test/setup/letter-fixtures";
import { DesignPane } from "./DesignPane";

function Harness({ initial, standalone = false, readOnly = false }: { initial: LetterDocument; standalone?: boolean; readOnly?: boolean }) {
    const [letter, setLetter] = useState(initial);
    const base = { ...DEFAULT_LETTER_DESIGN, accentColor: "#2563eb" };
    const design = applyDesignOverrides(base, letter.designOverrides);
    return (
        <>
            <DesignPane design={design} baseDesign={base} overridden={Object.keys(letter.designOverrides) as never} standalone={standalone} onChange={(change) => setLetter(change)} readOnly={readOnly} />
            <output data-testid="overrides">{JSON.stringify(letter.designOverrides)}</output>
        </>
    );
}

const overrides = () => JSON.parse(screen.getByTestId("overrides").textContent ?? "{}");

describe("DesignPane", () => {
    beforeEach(() => act(() => useI18nStore.setState({ locale: "en", _hydrated: true })));
    afterEach(cleanup);

    it("explains whether the design comes from the CV or is chosen here", () => {
        const { unmount } = render(<Harness initial={makeLetter()} />);
        expect(screen.getByText(/Starts from your CV's design/)).toBeInTheDocument();
        unmount();
        render(<Harness initial={makeLetter()} standalone />);
        expect(screen.getByText("Choose how this letter looks.")).toBeInTheDocument();
    });

    it("marks a value the letter changed, and resets it back to the base", () => {
        render(<Harness initial={makeLetter({ designOverrides: { marginHmm: 30 } })} />);
        const row = screen.getByTestId("letter-design-marginHmm");
        expect(within(row).getByTestId("letter-design-changed-marginHmm")).toBeInTheDocument();
        expect(screen.queryByTestId("letter-design-changed-fontSize")).toBeNull();

        fireEvent.click(within(row).getByTestId("letter-design-reset-marginHmm"));
        expect(overrides()).toEqual({});
        expect(screen.queryByTestId("letter-design-changed-marginHmm")).toBeNull();
    });

    it("resets every change at once", () => {
        render(<Harness initial={makeLetter({ designOverrides: { marginHmm: 30, marginVmm: 5 } })} />);
        fireEvent.click(screen.getByTestId("letter-design-reset-all"));
        expect(overrides()).toEqual({});
    });

    it("cannot be edited on a sent letter", () => {
        render(<Harness initial={makeLetter({ designOverrides: { marginHmm: 30 } })} readOnly />);
        expect(screen.queryByTestId("letter-design-reset-marginHmm")).toBeNull();
        expect(screen.queryByTestId("letter-design-reset-all")).toBeNull();
    });
});

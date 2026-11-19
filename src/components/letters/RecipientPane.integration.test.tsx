import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { todayIso, type LetterDocument } from "@/lib/letters/schema";
import { makeLetter } from "../../../test/setup/letter-fixtures";
import { RecipientPane } from "./RecipientPane";

function Harness({ readOnly = false }: { readOnly?: boolean }) {
    const [letter, setLetter] = useState<LetterDocument>(makeLetter({ date: "2026-01-05" }));
    return (
        <>
            <RecipientPane letter={letter} onChange={(change) => setLetter(change)} readOnly={readOnly} />
            <output data-testid="date-out">{letter.date}</output>
        </>
    );
}

describe("RecipientPane date", () => {
    beforeEach(() => act(() => useI18nStore.setState({ locale: "en", _hydrated: true })));
    afterEach(cleanup);

    it("uses the shared date picker and shows the stored day", () => {
        render(<Harness />);
        expect(screen.getByTestId("letter-date")).toHaveValue("2026-01-05");
    });

    it("sets the current day with the Today button", () => {
        render(<Harness />);
        fireEvent.click(screen.getByTestId("letter-date-today"));
        expect(screen.getByTestId("date-out")).toHaveTextContent(todayIso());
        expect(screen.getByTestId("letter-date")).toHaveValue(todayIso());
    });

    it("accepts a typed date", () => {
        render(<Harness />);
        fireEvent.change(screen.getByTestId("letter-date"), { target: { value: "2026-03-09" } });
        expect(screen.getByTestId("date-out")).toHaveTextContent("2026-03-09");
    });

    it("is locked on a sent letter", () => {
        render(<Harness readOnly />);
        expect(screen.getByTestId("letter-date")).toBeDisabled();
        expect(screen.getByTestId("letter-date-today")).toBeDisabled();
    });
});

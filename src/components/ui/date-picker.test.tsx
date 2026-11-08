import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatePicker } from "./date-picker";

describe("DatePicker", () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it("opens from the calendar button and selects month-level dates", () => {
        const onChange = vi.fn();
        render(<DatePicker label="Graduation Date" value="2025-04" onChange={onChange} precision="month" />);

        fireEvent.click(screen.getByRole("button", { name: "Open calendar" }));
        fireEvent.click(screen.getByRole("button", { name: "May 2025" }));

        expect(onChange).toHaveBeenLastCalledWith("2025-05");
    });

    it("accepts Present when allowed for range end dates", () => {
        const onChange = vi.fn();
        render(<DatePicker label="End Date" value="" onChange={onChange} precision="month" allowPresent />);

        fireEvent.change(screen.getByLabelText("End Date (YYYY-MM)"), {
            target: { value: "Present" },
        });

        expect(onChange).toHaveBeenLastCalledWith("Present");
    });

    it("accepts and displays the CV-language Present label", () => {
        const onChange = vi.fn();
        const { rerender } = render(
            <DatePicker label="Datum završetka" value="" onChange={onChange} precision="month" allowPresent language="bs" />,
        );

        fireEvent.change(screen.getByLabelText("Datum završetka (YYYY-MM)"), {
            target: { value: "Trenutno" },
        });
        expect(onChange).toHaveBeenLastCalledWith("Present");

        rerender(
            <DatePicker label="Datum završetka" value="Present" onChange={onChange} precision="month" allowPresent language="bs" />,
        );
        expect(screen.getByLabelText("Datum završetka (YYYY-MM)")).toHaveValue("Trenutno");
    });

    it("preserves a manually entered year without inventing January", () => {
        const onChange = vi.fn();
        render(<DatePicker label="Date of Birth" value="" onChange={onChange} precision="day" />);

        const input = screen.getByLabelText("Date of Birth (YYYY-MM-DD)");
        fireEvent.change(input, { target: { value: "1990" } });
        fireEvent.keyDown(input, { key: "Enter" });

        expect(onChange).toHaveBeenLastCalledWith("1990");
        expect(input).toHaveValue("1990");
    });
});

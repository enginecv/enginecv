import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import type { ConversionReport } from "@/lib/json-resume/report";
import { ConversionLossSummary } from "./ConversionLossSummary";

const report: ConversionReport = {
    items: [
        { kind: "left-out", code: "hidden-entries-left-out", section: "experience", count: 2 },
        { kind: "left-out", code: "declaration-left-out", section: "declaration" },
        { kind: "changed", code: "skill-groups-flattened", section: "skills", count: 3 },
    ],
};

describe("ConversionLossSummary", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(() => {
        cleanup();
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    it("renders nothing for a clean conversion", () => {
        const { container } = render(<ConversionLossSummary report={{ items: [] }} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("separates what was left out from what changed, with section names and counts", () => {
        render(<ConversionLossSummary report={report} defaultOpen />);
        const leftOut = screen.getByTestId("conversion-group-left-out");
        const changed = screen.getByTestId("conversion-group-changed");

        expect(within(leftOut).getByText("Hidden entries in Professional Experience were left out (2).")).toBeInTheDocument();
        expect(within(leftOut).getByText("The declaration was left out.")).toBeInTheDocument();
        expect(within(changed).getByText("Skill groups were merged into one list (3).")).toBeInTheDocument();
    });

    it("omits a group with no items", () => {
        render(<ConversionLossSummary report={{ items: [report.items[2]] }} defaultOpen />);
        expect(screen.queryByTestId("conversion-group-left-out")).not.toBeInTheDocument();
        expect(screen.getByTestId("conversion-group-changed")).toBeInTheDocument();
    });

    it("uses a general label for items that belong to no section", () => {
        render(<ConversionLossSummary report={{ items: [{ kind: "left-out", code: "invalid-values-skipped", section: "", count: 1 }] }} defaultOpen />);
        expect(screen.getByText("Values in the file that could not be read were skipped (1).")).toBeInTheDocument();
    });

    it("is translated and shows no raw codes in another language", () => {
        useI18nStore.setState({ locale: "de", _hydrated: true });
        render(<ConversionLossSummary report={report} defaultOpen />);
        expect(screen.getByText("Die Erklärung wurde weggelassen.")).toBeInTheDocument();
        expect(screen.getByTestId("conversion-loss-summary").textContent).not.toMatch(/conversion\.|left-out|flattened/);
    });
});

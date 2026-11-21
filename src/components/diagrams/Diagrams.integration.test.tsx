import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { DataMapDiagram } from "./DataMapDiagram";
import { DeleteScopeDiagram } from "./DeleteScopeDiagram";
import { ExportFormatsDiagram } from "./ExportFormatsDiagram";

beforeEach(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
afterEach(cleanup);

describe("DataMapDiagram", () => {
    it("shows the three zones and says no server holds the CV", () => {
        render(<DataMapDiagram />);
        expect(screen.getByTestId("diagram-no-server")).toHaveTextContent("No EngineCV server holds your CV");
        expect(within(screen.getByTestId("diagram-zone-browser")).getByRole("heading")).toHaveTextContent("This browser");
        expect(within(screen.getByTestId("diagram-zone-computer")).getByRole("heading")).toHaveTextContent("Your computer");
        expect(within(screen.getByTestId("diagram-zone-computer")).getByRole("heading")).toHaveTextContent("Optional");
        expect(screen.getByTestId("diagram-zone-leaves")).toHaveTextContent("An AI agent reading your file may send it to its provider");
    });

    it("adds the names developer tools show only in the detailed version", () => {
        const { unmount } = render(<DataMapDiagram />);
        expect(screen.queryByText(/IndexedDB › resumes/)).not.toBeInTheDocument();
        unmount();
        render(<DataMapDiagram detailed />);
        expect(screen.getByText(/IndexedDB › resumes/)).toBeInTheDocument();
        expect(screen.getByText(/IndexedDB › workspace/)).toBeInTheDocument();
    });

    it("is a captioned figure and hides its decorative arrows from screen readers", () => {
        render(<DataMapDiagram />);
        const figure = screen.getByTestId("diagram-data-map");
        expect(figure.tagName).toBe("FIGURE");
        expect(within(figure).getByText("Where your CV lives and when it leaves your device")).toBeInTheDocument();
        expect(figure.querySelectorAll("svg[aria-hidden='true'], [aria-hidden='true'] svg").length).toBeGreaterThan(0);
    });
});

describe("DeleteScopeDiagram", () => {
    it("says what is removed from the browser and what stays on the computer", () => {
        render(<DeleteScopeDiagram />);
        expect(within(screen.getByTestId("diagram-delete-removes")).getAllByRole("listitem")).toHaveLength(4);
        const stays = screen.getByTestId("diagram-delete-stays");
        expect(stays).toHaveTextContent("Files in your workspace folder");
        expect(stays).toHaveTextContent("Delete these yourself");
    });
});

describe("all five languages", () => {
    it.each(["en", "de", "bs", "fr", "es"] as const)("renders every diagram in %s without a missing label", (locale) => {
        useI18nStore.setState({ locale, _hydrated: true });
        render(<><DataMapDiagram detailed /><DeleteScopeDiagram /></>);
        // A missing key renders as the key itself.
        expect(document.body.textContent).not.toMatch(/diagram\.[a-z]+\./);
        if (locale !== "en") expect(screen.getByTestId("diagram-no-server").textContent).not.toBe("No EngineCV server holds your CV");
    });
});

describe("ExportFormatsDiagram", () => {
    it("places every export format the app has, and only those", async () => {
        const { EXPORT_FORMATS } = await import("@/lib/export-formats");
        const { EXPORT_FORMAT_GROUPS, ExportFormatsDiagram } = await import("./ExportFormatsDiagram");
        const mapped = Object.values(EXPORT_FORMAT_GROUPS).flat().sort();
        expect(mapped).toEqual(EXPORT_FORMATS.map((format) => format.id).sort());
        render(<ExportFormatsDiagram />);
        for (const format of EXPORT_FORMATS) {
            const item = screen.getByTestId(`diagram-export-${format.id}`);
            expect(item).toHaveTextContent(`.${format.extension}`);
        }
        expect(document.body.textContent).not.toMatch(/\.png|\.svg/);
    });

    it("marks password-capable formats and the content-only one", () => {
        render(<ExportFormatsDiagram />);
        expect(screen.getByTestId("diagram-export-json")).toHaveTextContent("Password option");
        expect(screen.getByTestId("diagram-export-pdf")).toHaveTextContent("Password option");
        expect(screen.getByTestId("diagram-export-jsonresume")).toHaveTextContent("Content only");
        expect(screen.getByTestId("diagram-export-docx")).not.toHaveTextContent("Content only");
    });
});

describe("new diagrams in all five languages", () => {
    it.each(["en", "de", "bs", "fr", "es"] as const)("has no missing label in %s", (locale) => {
        useI18nStore.setState({ locale, _hydrated: true });
        render(<ExportFormatsDiagram />);
        expect(document.body.textContent).not.toMatch(/diagram\.[a-z]+\./);
        expect(document.body.textContent).not.toMatch(/landing\.exports\./);
    });
});

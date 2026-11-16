import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getExportFormatCount } from "@/lib/export-formats";
import { useI18nStore } from "@/lib/i18n";
import { ExportFormatsSection } from "./ExportFormatsSection";

describe("ExportFormatsSection", () => {
  beforeEach(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
  afterEach(cleanup);

  it("states the real number of formats", () => {
    render(<ExportFormatsSection />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(`One CV, ${getExportFormatCount()} ways out`);
    expect(screen.getByTestId("diagram-export-formats")).toBeInTheDocument();
  });

  it.each(["bs", "de", "fr", "es"] as const)("is translated in %s", (locale) => {
    useI18nStore.setState({ locale, _hydrated: true });
    render(<ExportFormatsSection />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).not.toContain("ways out");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(String(getExportFormatCount()));
  });
});

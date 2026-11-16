import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EXPORT_FORMATS } from "@/lib/export-formats";
import { useI18nStore } from "@/lib/i18n";
import { JsonResumeSection } from "./JsonResumeSection";

describe("JsonResumeSection", () => {
  beforeEach(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
  afterEach(cleanup);

  it("only advertises a format the app really exports", () => {
    expect(EXPORT_FORMATS.some((format) => format.id === "jsonresume" && format.extension === "resume.json")).toBe(true);
    render(<JsonResumeSection />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Export to JSON Resume");
    expect(screen.getByTestId("landing-json-resume")).toHaveTextContent("john-doe.resume.json");
  });

  it("is honest that the file holds content only, and links the standard in a new tab", () => {
    render(<JsonResumeSection />);
    expect(screen.getByText(/Content only/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /About the JSON Resume standard/ });
    expect(link).toHaveAttribute("href", "https://jsonresume.org");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it.each(["bs", "de", "fr", "es"] as const)("is translated in %s", (locale) => {
    useI18nStore.setState({ locale, _hydrated: true });
    render(<JsonResumeSection />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).not.toContain("Export to JSON Resume");
  });
});

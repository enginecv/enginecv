import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { LinkedFileSection } from "./LinkedFileSection";

describe("LinkedFileSection", () => {
  beforeEach(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
  afterEach(cleanup);

  it("puts the file way up front, with its limits and a link to how it works", () => {
    render(<LinkedFileSection />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Your CV, in a file");
    expect(screen.getByText("EngineCV uploads nothing; the file stays on your disk")).toBeInTheDocument();
    expect(screen.getByText("Needs Chrome or Edge; other browsers use export and import")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /How linked files work/ })).toHaveAttribute("href", "/linked-files");
  });

  it.each(["bs", "de", "fr", "es"] as const)("is translated in %s", (locale) => {
    useI18nStore.setState({ locale, _hydrated: true });
    render(<LinkedFileSection />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).not.toContain("Your CV, in a file");
    expect(screen.getByRole("link", { name: /^(?!How linked files work)/ })).toBeTruthy();
  });
});

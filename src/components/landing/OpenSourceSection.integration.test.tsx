import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SOURCE_REPO_URL } from "@/lib/contact";
import { useI18nStore } from "@/lib/i18n";
import { OpenSourceSection } from "./OpenSourceSection";

describe("OpenSourceSection", () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: "en", _hydrated: true });
  });

  afterEach(() => {
    cleanup();
  });

  it("explains the project is open source and links to the repository", () => {
    render(<OpenSourceSection />);

    expect(screen.getByText("Built in")).toBeInTheDocument();
    expect(screen.getByText("the Open")).toBeInTheDocument();
    expect(screen.getByText(/published on GitHub under the AGPL-3.0/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View the source on GitHub" })).toHaveAttribute(
      "href",
      SOURCE_REPO_URL,
    );
    expect(screen.getByRole("link", { name: "How to contribute" })).toHaveAttribute(
      "href",
      `${SOURCE_REPO_URL}/blob/master/CONTRIBUTING.md`,
    );
  });

  it("is honest that the content is not open licensed", () => {
    render(<OpenSourceSection />);

    expect(screen.getByText(/Blog posts and guide text are not open licensed/)).toBeInTheDocument();
  });

  it.each([
    ["bs", "Razvijeno", "Kako doprinijeti"],
    ["de", "Offen", "So kannst du beitragen"],
    ["fr", "Développé", "Comment contribuer"],
    ["es", "Construido", "Cómo contribuir"],
  ] as const)("localizes the section in %s", (locale, title, contributing) => {
    useI18nStore.setState({ locale, _hydrated: true });
    render(<OpenSourceSection />);

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: contributing })).toBeInTheDocument();
  });
});

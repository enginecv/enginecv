import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { PrivacySection } from "./PrivacySection";

describe("PrivacySection", () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: "en", _hydrated: true });
  });

  afterEach(() => {
    cleanup();
  });

  it("explains resume storage without implementation jargon", () => {
    render(<PrivacySection />);

    expect(screen.getByText("Your Resume Stays")).toBeInTheDocument();
    expect(screen.getByText("On This Device")).toBeInTheDocument();
    expect(screen.getByText("No account means no server copy")).toBeInTheDocument();
    expect(screen.getByText("Page analytics are cookieless and never include your resume")).toBeInTheDocument();
    expect(screen.getByText("Your resume data is never sold")).toBeInTheDocument();
  });

  it("warns users to back up local resumes", () => {
    render(<PrivacySection />);

    expect(screen.getByText("Keep a backup")).toBeInTheDocument();
    expect(screen.getByText(/Clearing browser data can erase local resumes/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read the full privacy policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it.each([
    ["bs", "Vaš CV ostaje", "Vaši podaci iz CV-a nikada se ne prodaju"],
    ["de", "Dein Lebenslauf bleibt", "Deine Lebenslaufdaten werden nie verkauft"],
    ["fr", "Votre CV reste", "Les données de votre CV ne sont jamais vendues"],
    ["es", "Tu currículum permanece", "Los datos de tu currículum nunca se venden"],
  ] as const)("localizes the plain-language safety message in %s", (locale, title, neverSold) => {
    useI18nStore.setState({ locale, _hydrated: true });
    render(<PrivacySection />);

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByText(neverSold)).toBeInTheDocument();
  });
});

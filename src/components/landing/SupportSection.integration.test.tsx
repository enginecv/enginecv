import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { ENGINECV_GITHUB_PROFILE_URL, getKofiUrl } from "@/lib/support";
import { SupportSection } from "./SupportSection";

describe("SupportSection", () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: "en", _hydrated: true });
  });

  afterEach(() => {
    cleanup();
  });

  it("links founder credit and offers optional Ko-fi support", () => {
    render(<SupportSection />);

    expect(screen.getByText("EngineCV is free to use.")).toBeInTheDocument();
    expect(screen.getByText("EngineCV is built and maintained by")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Safet" })).toHaveAttribute(
      "href",
      ENGINECV_GITHUB_PROFILE_URL,
    );
    expect(screen.getByRole("link", { name: "Support EngineCV on Ko-fi" })).toHaveAttribute(
      "href",
      getKofiUrl("landing"),
    );
    expect(screen.getByRole("link", { name: "Support EngineCV on Ko-fi" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(screen.queryByText("Built by one person.")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View source" })).not.toBeInTheDocument();
  });

  it.each([
    ["bs", "EngineCV je besplatan za korištenje.", "Podrži EngineCV na Ko-fi"],
    ["de", "EngineCV ist kostenlos nutzbar.", "EngineCV auf Ko-fi unterstützen"],
    ["fr", "EngineCV est gratuit.", "Soutenir EngineCV sur Ko-fi"],
    ["es", "EngineCV es gratis.", "Apoya EngineCV en Ko-fi"],
  ] as const)("localizes support copy in %s", (locale, title, cta) => {
    useI18nStore.setState({ locale, _hydrated: true });
    render(<SupportSection />);

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: cta })).toHaveAttribute("href", getKofiUrl("landing"));
  });
});

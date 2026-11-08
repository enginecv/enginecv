import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteLocaleProvider } from "@/lib/i18n/route-locale";
import { bs } from "@/lib/i18n/bs";
import { de } from "@/lib/i18n/de";
import { fr } from "@/lib/i18n/fr";
import { es } from "@/lib/i18n/es";
import { MultiDocumentInput } from "./passport-id-input";
import { DisabilityInput } from "./disability-input";
import { DrivingLicenseInput } from "./driving-license-input";
import { DatePicker } from "./date-picker";
import { CustomIconSelect } from "@/components/editor/FormUtils";
import { ContactContent } from "@/components/contact/ContactContent";
import { SupportersContent } from "@/components/support/SupportersContent";

vi.mock("next/navigation", () => ({
    usePathname: () => "/contact",
    useRouter: () => ({ prefetch: vi.fn() }),
}));

afterEach(cleanup);
const dictionaries = { bs, de, fr, es };

function localized(locale: keyof typeof dictionaries, children: ReactNode) {
    return <RouteLocaleProvider locale={locale} messages={dictionaries[locale]}>{children}</RouteLocaleProvider>;
}

describe("shared GUI localization", () => {
    it.each(["bs", "de", "fr", "es"] as const)("localizes document and disability controls in %s", (locale) => {
        const dictionary = dictionaries[locale];
        render(localized(locale, <>
            <MultiDocumentInput value="DE: 12345" onChange={vi.fn()} />
            <DisabilityInput value="other:" onChange={vi.fn()} />
        </>));
        expect(screen.getByRole("textbox", { name: dictionary["input.documentNumber"] })).toHaveValue("12345");
        expect(screen.getByRole("button", { name: dictionary["input.removeDocument"] })).toBeVisible();
        expect(screen.getByRole("button", { name: dictionary["input.addDocument"] })).toBeVisible();
        expect(screen.getByRole("textbox", { name: dictionary["input.describeDisability"] })).toHaveAttribute("placeholder", dictionary["input.describeOptional"]);
        expect(screen.queryByRole("button", { name: "Remove document" })).toBeNull();
    });

    it("updates icon names and searches translated names when the UI language changes", () => {
        const { rerender } = render(localized("de", <CustomIconSelect linkName="section" value="graduation-cap" onChange={vi.fn()} />));
        fireEvent.click(screen.getByRole("button", { name: "Absolventenhut" }));
        fireEvent.change(screen.getByPlaceholderText(de["iconPicker.search"]), { target: { value: "Aktentasche" } });
        expect(screen.getByTitle("Aktentasche")).toBeVisible();
        expect(screen.queryByTitle("Briefcase")).toBeNull();
        rerender(localized("bs", <CustomIconSelect linkName="section" value="graduation-cap" onChange={vi.fn()} />));
        expect(screen.getByRole("button", { name: "Diplomska kapa" })).toBeVisible();
    });

    it("localizes license category descriptions without changing saved class codes", () => {
        const change = vi.fn();
        render(localized("de", <DrivingLicenseInput value="DE: B" onChange={change} />));
        fireEvent.click(screen.getByText("B"));
        const category = screen.getByRole("option", { name: /Kraftwagen bis 3.500 kg/ });
        expect(category).toBeVisible();
        fireEvent.click(category);
        expect(change).toHaveBeenCalledWith("DE: ");
    });

    it("localizes calendar month names and year-navigation labels", () => {
        render(localized("de", <DatePicker precision="month" value="2026-05" onChange={vi.fn()} />));
        fireEvent.click(screen.getByRole("button", { name: de["datePicker.openCalendar"] }));
        expect(screen.getByRole("button", { name: "Mai 2026" })).toBeVisible();
        expect(screen.getByRole("button", { name: "Vorheriges Jahr" })).toBeVisible();
    });

    it("localizes contact and donation pages", () => {
        const { unmount } = render(localized("bs", <ContactContent />));
        expect(screen.getByRole("heading", { name: "Kontaktirajte EngineCV" })).toBeVisible();
        expect(screen.getByRole("link", { name: "Pošaljite email podršci" })).toBeVisible();
        expect(screen.getByRole("heading", { name: "Osnivač" })).toBeVisible();
        unmount();
        render(localized("fr", <SupportersContent />));
        expect(screen.getByRole("heading", { name: "Merci" })).toBeVisible();
        expect(screen.getAllByRole("link", { name: "Soutenir EngineCV sur Ko-fi" }).length).toBeGreaterThan(0);
    });
});

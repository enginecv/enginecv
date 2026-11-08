import type { Locale } from "@/lib/i18n/locales";
import type { ExampleContent, ExampleResumeInput } from "./types";

export type { ExampleContent, ExampleResumeInput } from "./types";

export const EXAMPLE_ROLE_IDS = ["software-developer", "nurse", "sales-office", "graduate"] as const;

export type ExampleRoleId = (typeof EXAMPLE_ROLE_IDS)[number];

export type ExampleRole = {
    id: ExampleRoleId;
    titleKey: string;
    hintKey: string;
    /** Content loads only when the role is picked, never with the dashboard. */
    load: () => Promise<ExampleContent>;
};

export const EXAMPLE_ROLES: readonly ExampleRole[] = [
    {
        id: "software-developer",
        titleKey: "onboarding.example.software-developer.title",
        hintKey: "onboarding.example.software-developer.hint",
        load: () => import("./software-developer").then((module) => module.content),
    },
    {
        id: "nurse",
        titleKey: "onboarding.example.nurse.title",
        hintKey: "onboarding.example.nurse.hint",
        load: () => import("./nurse").then((module) => module.content),
    },
    {
        id: "sales-office",
        titleKey: "onboarding.example.sales-office.title",
        hintKey: "onboarding.example.sales-office.hint",
        load: () => import("./sales-office").then((module) => module.content),
    },
    {
        id: "graduate",
        titleKey: "onboarding.example.graduate.title",
        hintKey: "onboarding.example.graduate.hint",
        load: () => import("./graduate").then((module) => module.content),
    },
];

export function getExampleRole(id: ExampleRoleId): ExampleRole {
    const role = EXAMPLE_ROLES.find((entry) => entry.id === id);
    if (!role) throw new Error(`Unknown example role "${id}".`);
    return role;
}

/**
 * The example in the visitor's language when a reviewed translation exists,
 * otherwise English. v1 ships English only.
 */
export function resolveExampleContent(content: ExampleContent, locale: Locale): { locale: Locale; input: ExampleResumeInput } {
    const localized = content[locale];
    return localized ? { locale, input: localized() } : { locale: "en", input: content.en() };
}

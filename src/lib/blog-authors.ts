import type { Locale } from "@/lib/i18n/locales";

export interface BlogAuthorLinks {
    website?: string;
    linkedin?: string;
    cv?: string;
    contact?: string;
}

export interface BlogAuthor {
    id: string;
    name: string;
    role: string;
    /** The role in other languages; English `role` is the fallback. */
    roles?: Partial<Record<Locale, string>>;
    bio: string;
    links: BlogAuthorLinks;
}

const BLOG_AUTHORS = {
    "safet-imamovic": {
        id: "safet-imamovic",
        name: "Safet Imamovic",
        role: "Founder, EngineCV",
        roles: { de: "Gründer, EngineCV", bs: "Osnivač, EngineCV", fr: "Fondateur, EngineCV", es: "Fundador, EngineCV" },
        bio: "Builds local-first career tools and writes practical resume advice grounded in real hiring friction.",
        links: {
            linkedin: "https://www.linkedin.com/in/safet-imamovic/",
            cv: "https://example.com/safet-imamovic-cv",
            contact: "mailto:safet@example.com",
        },
    },
    "mila-hadzic": {
        id: "mila-hadzic",
        name: "Mila Hadzic",
        role: "Content Strategist",
        roles: { de: "Content-Strategin", bs: "Strateginja sadržaja", fr: "Stratège de contenu", es: "Estratega de contenidos" },
        bio: "Focuses on search-driven career content, ATS formatting, and turning blog readers into product users.",
        links: {
            website: "https://example.com/mila-hadzic",
            linkedin: "https://www.linkedin.com/in/mila-hadzic/",
            contact: "mailto:mila@example.com",
        },
    },
    "emir-kovacevic": {
        id: "emir-kovacevic",
        name: "Emir Kovacevic",
        role: "Career Writing Editor",
        roles: { de: "Redakteur für Karrierethemen", bs: "Urednik za karijerne teme", fr: "Rédacteur carrière", es: "Editor de contenidos de carrera" },
        bio: "Edits resumes for clarity, proof, and scan speed while keeping the writing grounded in the candidate's actual work.",
        links: {
            website: "https://example.com/emir-kovacevic",
            cv: "https://example.com/emir-kovacevic-cv",
        },
    },
} satisfies Record<string, BlogAuthor>;

export type BlogAuthorId = keyof typeof BLOG_AUTHORS;

export function authorRole(author: BlogAuthor, locale: Locale): string {
    return author.roles?.[locale] ?? author.role;
}

export function getBlogAuthor(authorId: string) {
    return BLOG_AUTHORS[authorId as BlogAuthorId] ?? null;
}

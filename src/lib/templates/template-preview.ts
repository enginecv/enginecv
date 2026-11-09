import { createEmptyResume, type Resume } from "../schema";
import type { TemplatePreviewOptions } from "./enginecv-templates";

// An illustrated placeholder portrait, not a photo of anyone.
const SAMPLE_PHOTO = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160"><defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2e8f0"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient></defs><rect width="120" height="160" fill="url(#b)"/><circle cx="60" cy="62" r="26" fill="#94a3b8"/><path d="M14 160c4-34 22-52 46-52s42 18 46 52z" fill="#64748b"/></svg>',
)}`;

// A drawn-looking signature for the place, date and signature line.
const SAMPLE_SIGNATURE = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 70"><path d="M8 50c14-30 26-40 30-32s-14 34-6 34 22-36 30-30-6 26 2 26 16-20 24-22 4 14 12 14 18-18 30-20 6 10 16 10 30-12 52-16" fill="none" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
)}`;

/**
 * Builds a sample resume used as the preview body when editing a template.
 * Templates only carry visual settings, so the preview needs realistic content
 * to render against — hard-coded here so it never drifts with user data.
 */
export function getSampleResumeForTemplatePreview(options: TemplatePreviewOptions = {}): Resume {
    // Photo templates show Jane, the rest John, so the gallery reads as two people.
    const sample = buildEnglishSample(options.photo ? SAMPLE_PEOPLE.jane : SAMPLE_PEOPLE.john);
    const withLanguage = options.language === "de" ? toGermanSample(sample) : sample;
    return options.photo ? { ...withLanguage, basics: { ...withLanguage.basics, photo: SAMPLE_PHOTO } } : withLanguage;
}

const SAMPLE_PEOPLE = {
    john: { name: "John Doe", email: "john.doe@example.com", website: "https://johndoe.example" },
    jane: { name: "Jane Doe", email: "jane.doe@example.com", website: "https://janedoe.example" },
};

function buildEnglishSample(person: (typeof SAMPLE_PEOPLE)["john"]): Resume {
    const base = createEmptyResume();
    const now = Date.now();

    return {
        ...base,
        id: "__template-preview__",
        createdAt: now,
        updatedAt: now,
        meta: {
            ...base.meta,
            title: "Template preview",
        },
        settings: {
            ...base.settings,
            // The national number alone ("030 12345678"), with no flag or country name.
            phoneDisplay: "hide",
            // One plain line per language ("English, Native") keeps every section on page one.
            languagesSection: { ...base.settings.languagesSection, fluencyDisplay: "text", fluencySize: 1, fluencyPlacement: "sameLine" },
        },
        basics: {
            ...base.basics,
            name: person.name,
            headline: "Senior Product Designer",
            email: person.email,
            phone: "+49 30 12345678",
            location: "Berlin, Germany",
            website: person.website,
            linkedin: "https://www.linkedin.com/in/example",
            github: "https://github.com/example",
            summary:
                "Product designer with 8 years in B2B SaaS and fintech, leading design systems and research.",
        },
        // Bullets live in the description: it is what the editor writes, and the
        // preview shows the description in place of highlights when both exist.
        experience: [
            {
                ...emptyEntry(base.experience[0]),
                id: "preview-exp-1",
                company: "Northwind Labs",
                position: "Senior Product Designer",
                start: "2022-03",
                end: "Present",
                location: "Berlin, Germany",
                url: "https://northwind.example",
                urlIcon: "auto",
                description: [
                    "- Cut time to first insight by 31% for 40,000 monthly users.",
                    "- Built a component library used by 5 teams and 60+ engineers.",
                    "- Ran 12 customer research rounds that shaped 3 roadmap bets.",
                ].join("\n"),
                highlights: [],
            },
            {
                ...emptyEntry(base.experience[0]),
                id: "preview-exp-2",
                company: "Lumen Studio",
                position: "Product Designer",
                start: "2018-09",
                end: "2022-02",
                location: "Amsterdam, Netherlands",
                url: "",
                urlIcon: "auto",
                description: [
                    "- Lifted signup activation by 18% across 9 EU markets.",
                    "- Launched multi-currency invoicing, now €2M+ a month.",
                    "- Cut billing support tickets by 27%.",
                ].join("\n"),
                highlights: [],
            },
        ],
        education: [
            {
                id: "preview-edu-1",
                hidden: false,
                institution: "Delft University of Technology",
                area: "Industrial Design Engineering",
                studyType: "MSc",
                start: "2015-09",
                end: "2018-06",
                location: "Delft, Netherlands",
                description: "",
                courses: ["Human-Computer Interaction", "Accessible Design"],
                score: "",
                skills: [],
                url: "",
                urlIcon: "auto",
            },
        ],
        // No certificates: one fixed section set that fits one A4 page in every
        // template, so previews never differ by which sections spilled over.
        certificates: [],
        projects: [
            {
                id: "preview-proj-1",
                hidden: false,
                name: "Open Design Tokens",
                subtitle: "Maintainer",
                start: "2020-01",
                end: "Present",
                url: "https://github.com/example/open-design-tokens",
                description: "Open-source design-token spec with 1,200+ GitHub stars.",
                highlights: [],
                keywords: ["Design Systems", "Open Source"],
                skills: [],
                urlIcon: "auto",
                repos: [],
                icon: "",
                visibility: "",
            },
        ],
        skillGroups: [
            {
                id: "ungrouped",
                name: "",
                hidden: false,
                skills: [
                    { hidden: false, id: "preview-skill-1", name: "Design Systems", description: "", level: "Expert", icon: "auto", display: "both" as const, keywords: [] },
                    { hidden: false, id: "preview-skill-2", name: "Figma", description: "", level: "Expert", icon: "auto", display: "both" as const, keywords: [] },
                    { hidden: false, id: "preview-skill-3", name: "Prototyping", description: "", level: "Advanced", icon: "auto", display: "both" as const, keywords: [] },
                    { hidden: false, id: "preview-skill-4", name: "User Research", description: "", level: "Advanced", icon: "auto", display: "both" as const, keywords: [] },
                    { hidden: false, id: "preview-skill-5", name: "Accessibility", description: "", level: "Advanced", icon: "auto", display: "both" as const, keywords: [] },
                    { hidden: false, id: "preview-skill-6", name: "Usability Testing", description: "", level: "Advanced", icon: "auto", display: "both" as const, keywords: [] },
                ],
            },
        ],
        languages: [
            { hidden: false, id: "preview-lang-1", language: "English", fluency: "Native", cefrDetailed: false, cefr: { listening: "", reading: "", spokenInteraction: "", spokenProduction: "", writing: "" }, assessmentType: "none", issuer: "", assessmentId: "", assessmentUrl: "", description: "" },
            { hidden: false, id: "preview-lang-2", language: "German", fluency: "C1", cefrDetailed: false, cefr: { listening: "", reading: "", spokenInteraction: "", spokenProduction: "", writing: "" }, assessmentType: "none", issuer: "", assessmentId: "", assessmentUrl: "", description: "" },
            { hidden: false, id: "preview-lang-3", language: "Dutch", fluency: "B2", cefrDetailed: false, cefr: { listening: "", reading: "", spokenInteraction: "", spokenProduction: "", writing: "" }, assessmentType: "none", issuer: "", assessmentId: "", assessmentUrl: "", description: "" },
        ],
    };
}

/**
 * The same person as a German Lebenslauf: German CV language and wording, plus
 * the closing place, date and signature line German employers expect.
 */
function toGermanSample(sample: Resume): Resume {
    const [job1, job2] = sample.experience;
    const [edu] = sample.education;
    const [project] = sample.projects;
    const skillNames = ["Designsysteme", "Figma", "Prototyping", "Nutzerforschung", "Barrierefreiheit", "Usability-Tests"];
    const languageNames = ["Englisch", "Deutsch", "Niederländisch"];

    return {
        ...sample,
        settings: {
            ...sample.settings,
            language: "de",
            // An explicit list renders only these, so name every sample section.
            contentSections: ["experience", "education", "projects", "skills", "languages", "declaration"],
        },
        basics: {
            ...sample.basics,
            location: "Berlin, Deutschland",
            summary: "8 Jahre Erfahrung im Produktdesign für B2B-SaaS und Fintech, mit Schwerpunkt auf Designsystemen und Nutzerforschung.",
        },
        experience: [
            {
                ...job1,
                location: "Berlin, Deutschland",
                description: [
                    "- Zeit bis zur ersten Erkenntnis um 31 % verkürzt (40.000 Nutzer).",
                    "- Komponentenbibliothek für 5 Teams und über 60 Entwickler aufgebaut.",
                    "- 12 Forschungsrunden geleitet, die 3 Roadmap-Entscheidungen prägten.",
                ].join("\n"),
            },
            {
                ...job2,
                location: "Amsterdam, Niederlande",
                description: [
                    "- Aktivierung in 9 EU-Märkten um 18 % gesteigert.",
                    "- Mehrwährungs-Rechnungen eingeführt, heute über 2 Mio. € im Monat.",
                    "- Support-Anfragen zur Abrechnung um 27 % gesenkt.",
                ].join("\n"),
            },
        ],
        education: [{ ...edu, institution: "Technische Universität Delft", location: "Delft, Niederlande" }],
        projects: [{ ...project, description: "Open-Source-Spezifikation für Design-Tokens, über 1.200 GitHub-Sterne." }],
        skillGroups: sample.skillGroups.map((group) => ({
            ...group,
            skills: group.skills.map((skill, i) => ({ ...skill, name: skillNames[i] ?? skill.name })),
        })),
        // The fluency is shown as typed, so the mother tongue is written in German.
        languages: sample.languages.map((language, i) => ({
            ...language,
            language: languageNames[i] ?? language.language,
            fluency: i === 0 ? "Muttersprache" : language.fluency,
        })),
        declaration: [{
            id: "preview-declaration-1",
            hidden: false,
            text: "",
            signature: SAMPLE_SIGNATURE,
            fullName: sample.basics.name,
            place: "Berlin",
            // Free text in the editor; German CVs write the date day first.
            date: "05.10.2026",
        }],
    };
}

function emptyEntry(template: Resume["experience"][number] | undefined): Resume["experience"][number] {
    return template
        ? { ...template }
        : {
            id: "",
            hidden: false,
            company: "",
            position: "",
            start: "",
            end: "",
            location: "",
            description: "",
            highlights: [],
            skills: [],
            url: "",
            urlIcon: "auto",
        };
}

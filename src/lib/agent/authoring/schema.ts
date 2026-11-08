import { z } from "zod";

/**
 * The `enginecv.authoring/v1` definition. One table of fields per section
 * drives both the Zod schema (and through it the published JSON Schema) and
 * the importer's idea of which fields are known, so the two cannot drift.
 *
 * The Zod schema is the lenient input form: every field optional, alternative
 * shapes as unions, unknown keys allowed (`catchall`) so the importer can
 * report them instead of failing. `resumeToAuthoring` writes only the
 * canonical subset.
 */

export const AUTHORING_FORMAT = "enginecv.authoring/v1";
export const AUTHORING_FORMAT_PREFIX = "enginecv.authoring/v";
export const AUTHORING_SCHEMA_URL = "https://enginecv.app/schema/authoring/v1.json";

export type FieldKind =
    | "id"
    | "hidden"
    | "text"
    | "markdown"
    | "date"
    | "link"
    | "email"
    | "list"
    | "highlights"
    | "repos"
    | "visibility"
    | "skillLevel";

export interface FieldSpec {
    kind: FieldKind;
    describe: string;
}

export interface EntrySpec {
    /** Canonical fields in output order. */
    fields: Record<string, FieldSpec>;
    /** Other names AIs use for a field, mapped to the canonical name (with a notice). */
    aliases: Record<string, string>;
}

const DATE_DESCRIPTION =
    'A date as "YYYY" or "YYYY-MM"; an end date still running is "present". Leave it out when unknown.';

const f = (kind: FieldKind, describe: string): FieldSpec => ({ kind, describe });

const ID = f("id", "Optional entry id. Keep ids you were given so entries can be matched later; never invent them.");
const HIDDEN = f("hidden", "true hides the entry from the printed CV. Leave it out otherwise.");
const DESCRIPTION = f("markdown", "Free text in Markdown (bold, italic, links, bullet lists).");
const SKILLS = f("list", "Skills used here, as short names.");
const URL = f("link", "A link for this entry.");
const START = f("date", `Start date. ${DATE_DESCRIPTION}`);
const END = f("date", `End date. ${DATE_DESCRIPTION}`);
const LOCATION = f("text", "City and/or country.");

const DATE_ALIASES = { startDate: "start", endDate: "end", from: "start", to: "end", until: "end" };

export const SECTION_ENTRY_SPECS = {
    experience: {
        fields: {
            id: ID,
            position: f("text", "Job title."),
            company: f("text", "Employer."),
            location: LOCATION,
            start: START,
            end: END,
            description: DESCRIPTION,
            highlights: f("highlights", "Achievements, one short sentence each."),
            skills: SKILLS,
            url: URL,
            hidden: HIDDEN,
        },
        aliases: {
            ...DATE_ALIASES,
            title: "position", role: "position", jobTitle: "position",
            employer: "company", organization: "company", organisation: "company", name: "company",
            summary: "description", achievements: "highlights", website: "url", link: "url",
        },
    },
    education: {
        fields: {
            id: ID,
            institution: f("text", "School or university."),
            studyType: f("text", 'Degree or qualification, e.g. "Bachelor", "MSc".'),
            area: f("text", "Field of study."),
            location: LOCATION,
            start: START,
            end: END,
            score: f("text", "Grade or GPA, as written on the diploma."),
            description: DESCRIPTION,
            courses: f("list", "Notable courses."),
            skills: SKILLS,
            url: URL,
            hidden: HIDDEN,
        },
        aliases: {
            ...DATE_ALIASES,
            school: "institution", university: "institution", name: "institution",
            degree: "studyType", qualification: "studyType",
            field: "area", fieldOfStudy: "area", major: "area", subject: "area",
            grade: "score", gpa: "score", summary: "description", website: "url", link: "url",
        },
    },
    courses: {
        fields: {
            id: ID,
            name: f("text", "Course name."),
            institution: f("text", "Who ran the course."),
            location: LOCATION,
            start: START,
            end: END,
            description: DESCRIPTION,
            skills: SKILLS,
            url: URL,
            hidden: HIDDEN,
        },
        aliases: { ...DATE_ALIASES, title: "name", provider: "institution", summary: "description", link: "url" },
    },
    projects: {
        fields: {
            id: ID,
            name: f("text", "Project name."),
            subtitle: f("text", "Short tagline or role."),
            start: START,
            end: END,
            description: DESCRIPTION,
            highlights: f("highlights", "Achievements, one short sentence each."),
            keywords: f("list", "Search keywords."),
            skills: SKILLS,
            url: URL,
            repos: f("repos", 'Source repositories: URLs, or { "url", "label" } objects.'),
            visibility: f("visibility", 'Repository visibility: "public" or "private".'),
            hidden: HIDDEN,
        },
        aliases: {
            ...DATE_ALIASES,
            title: "name", role: "subtitle", summary: "description",
            technologies: "skills", website: "url", link: "url", repositories: "repos",
        },
    },
    organisations: {
        fields: {
            id: ID,
            name: f("text", "Organisation, club or volunteer group."),
            role: f("text", "Your role there."),
            location: LOCATION,
            start: START,
            end: END,
            description: DESCRIPTION,
            skills: SKILLS,
            url: URL,
            hidden: HIDDEN,
        },
        aliases: {
            ...DATE_ALIASES,
            organization: "name", organisation: "name", position: "role", title: "role",
            summary: "description", website: "url", link: "url",
        },
    },
    certificates: {
        fields: {
            id: ID,
            name: f("text", "Certificate name."),
            issuer: f("text", "Issuing body."),
            date: f("date", `Date earned. ${DATE_DESCRIPTION}`),
            description: DESCRIPTION,
            skills: SKILLS,
            url: f("link", "Verification link."),
            issuerUrl: f("link", "Issuer's website."),
            hidden: HIDDEN,
        },
        aliases: { title: "name", authority: "issuer", issued: "date", summary: "description", link: "url" },
    },
    awards: {
        fields: {
            id: ID,
            name: f("text", "Award name."),
            issuer: f("text", "Who gave it."),
            date: f("date", `Date received. ${DATE_DESCRIPTION}`),
            description: DESCRIPTION,
            skills: SKILLS,
            url: URL,
            hidden: HIDDEN,
        },
        aliases: { title: "name", awarder: "issuer", summary: "description", link: "url" },
    },
    publications: {
        fields: {
            id: ID,
            name: f("text", "Title."),
            publisher: f("text", "Journal, conference or publisher."),
            date: f("date", `Publication date. ${DATE_DESCRIPTION}`),
            description: DESCRIPTION,
            skills: SKILLS,
            url: URL,
            hidden: HIDDEN,
        },
        aliases: { title: "name", releaseDate: "date", summary: "description", link: "url" },
    },
    references: {
        fields: {
            id: ID,
            name: f("text", "Referee's name."),
            position: f("text", "Their job title."),
            organisation: f("text", "Their employer."),
            email: f("email", "Their email address."),
            phone: f("text", "Their phone number."),
            description: DESCRIPTION,
            url: URL,
            hidden: HIDDEN,
        },
        aliases: { title: "position", company: "organisation", organization: "organisation", reference: "description", link: "url" },
    },
    declaration: {
        fields: {
            id: ID,
            text: f("markdown", "The declaration text."),
            fullName: f("text", "Name under the signature."),
            place: f("text", "Place of signing."),
            date: f("text", "Date of signing, as it should be printed."),
            hidden: HIDDEN,
        },
        aliases: { name: "fullName", location: "place" },
    },
    interests: {
        fields: {
            id: ID,
            name: f("text", "The interest."),
            description: DESCRIPTION,
            hidden: HIDDEN,
        },
        aliases: { title: "name", summary: "description" },
    },
    customEntry: {
        fields: {
            id: ID,
            title: f("text", "Entry title."),
            subtitle: f("text", "Second line."),
            location: LOCATION,
            start: START,
            end: END,
            description: DESCRIPTION,
            skills: SKILLS,
            url: URL,
            hidden: HIDDEN,
        },
        aliases: {
            ...DATE_ALIASES,
            name: "title", position: "title", role: "subtitle", company: "subtitle",
            organization: "subtitle", organisation: "subtitle", summary: "description", link: "url",
        },
    },
    skill: {
        fields: {
            id: ID,
            name: f("text", "Skill name."),
            level: f("skillLevel", 'One of "beginner", "amateur", "competent", "proficient", "expert". Leave it out when unknown.'),
            description: f("text", "Short note on the skill."),
            keywords: f("list", "Related terms."),
            hidden: HIDDEN,
        },
        aliases: { skill: "name", title: "name", proficiency: "level", rating: "level", note: "description" },
    },
} satisfies Record<string, EntrySpec>;

export type EntrySpecKey = keyof typeof SECTION_ENTRY_SPECS;

/** Sections that are a plain list of entries described by SECTION_ENTRY_SPECS. */
export const LIST_SECTION_KEYS = [
    "experience",
    "education",
    "courses",
    "projects",
    "organisations",
    "certificates",
    "awards",
    "publications",
    "references",
] as const satisfies readonly EntrySpecKey[];
export type ListSectionKey = (typeof LIST_SECTION_KEYS)[number];

/** Every top-level section, in canonical order. */
export const AUTHORING_SECTION_KEYS = [
    ...LIST_SECTION_KEYS,
    "declaration",
    "skills",
    "languages",
    "interests",
    "custom",
] as const;
export type AuthoringSectionKey = (typeof AUTHORING_SECTION_KEYS)[number];

/** Section names AIs commonly use instead of ours. */
export const SECTION_SYNONYMS: Readonly<Record<string, AuthoringSectionKey>> = {
    work: "experience",
    jobs: "experience",
    employment: "experience",
    workExperience: "experience",
    work_experience: "experience",
    positions: "experience",
    schools: "education",
    trainings: "courses",
    certifications: "certificates",
    licenses: "certificates",
    volunteering: "organisations",
    volunteer: "organisations",
    organizations: "organisations",
    memberships: "organisations",
    honors: "awards",
    honours: "awards",
    hobbies: "interests",
    referees: "references",
    customSections: "custom",
    sections: "custom",
};

// ---------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------

export const BASICS_FIELDS = {
    name: f("text", "Full name."),
    headline: f("text", "Short professional title under the name."),
    email: f("email", "Email address, or a list of them."),
    phone: f("text", "Phone number with country code."),
    location: f("text", "City and country."),
    website: f("link", "Personal website."),
    linkedin: f("link", "LinkedIn profile URL."),
    github: f("link", "GitHub profile URL."),
    links: f("link", 'Other profiles: [{ "name", "url", "label" }].'),
    drivingLicense: f("text", 'Driving licence categories, e.g. "B".'),
    nationality: f("text", "Nationality as an ISO country code (\"BA\") or a name."),
    dateOfBirth: f("text", "Date of birth, only if the person wants it on the CV."),
    passport: f("text", "Passport number, only if the person wants it on the CV."),
    nationalId: f("text", "National ID number, only if the person wants it on the CV."),
    maritalStatus: f("text", "Marital status, only if the person wants it on the CV."),
    militaryService: f("text", "Military service status."),
    genderPronoun: f("text", "Gender or pronouns."),
    disability: f("text", "Disability status."),
    visa: f("text", "Work permit or visa."),
    height: f("text", "Height."),
} satisfies Record<string, FieldSpec>;

export type BasicsField = keyof typeof BASICS_FIELDS;

/** Left out of Copy for AI unless the user opts in (research R7). */
export const SENSITIVE_BASICS_FIELDS: readonly BasicsField[] = [
    "dateOfBirth",
    "passport",
    "nationalId",
    "maritalStatus",
    "militaryService",
    "genderPronoun",
    "disability",
    "visa",
    "height",
];

export const BASICS_ALIASES: Readonly<Record<string, BasicsField>> = {
    fullName: "name",
    title: "headline",
    label: "headline",
    emails: "email",
    mobile: "phone",
    telephone: "phone",
    address: "location",
    city: "location",
    url: "website",
    homepage: "website",
    profiles: "links",
    customLinks: "links",
    birthDate: "dateOfBirth",
    dob: "dateOfBirth",
    pronouns: "genderPronoun",
};

export const LANGUAGE_FIELDS = ["id", "language", "level", "cefr", "certificate", "selfAssessed", "description", "hidden"] as const;
export const LANGUAGE_ALIASES: Readonly<Record<string, (typeof LANGUAGE_FIELDS)[number]>> = {
    name: "language",
    fluency: "level",
    proficiency: "level",
};
export const CUSTOM_SECTION_FIELDS = ["id", "title", "text", "tags", "entries", "hidden"] as const;
export const DESIGN_FIELDS = ["template", "accent", "cvLanguage"] as const;

/** Top-level keys that hold a photo; never imported (FR-021). */
export const PHOTO_KEYS: readonly string[] = ["photo", "image", "picture", "avatar", "photoEdit"];

/** Top-level keys AIs use for the summary. */
export const SUMMARY_ALIASES: readonly string[] = ["about", "objective", "profileSummary"];

// ---------------------------------------------------------------------------
// Zod
// ---------------------------------------------------------------------------

function zodForKind(kind: FieldKind): z.ZodType {
    switch (kind) {
        case "hidden":
            return z.boolean();
        case "list":
            return z.array(z.string());
        case "highlights":
            return z.union([z.array(z.string()), z.string()]);
        case "repos":
            return z.array(z.union([
                z.string(),
                z.object({ url: z.string(), label: z.string().optional(), platform: z.string().optional() }),
            ]));
        case "visibility":
            return z.enum(["public", "private"]);
        default:
            return z.string();
    }
}

function entrySchema(spec: EntrySpec) {
    const shape: Record<string, z.ZodType> = {};
    for (const [name, field] of Object.entries(spec.fields)) {
        shape[name] = zodForKind(field.kind).describe(field.describe).optional();
    }
    return z.object(shape).catchall(z.unknown());
}

const listEntrySchemas = Object.fromEntries(
    LIST_SECTION_KEYS.map((key) => [key, z.array(entrySchema(SECTION_ENTRY_SPECS[key])).optional()]),
) as Record<ListSectionKey, z.ZodOptional<z.ZodArray<ReturnType<typeof entrySchema>>>>;

const emailObjectSchema = z.object({ email: z.string(), label: z.string().optional() });

const basicsShape: Record<string, z.ZodType> = {};
for (const [name, field] of Object.entries(BASICS_FIELDS)) {
    const type = name === "email"
        ? z.union([z.string(), z.array(z.union([z.string(), emailObjectSchema]))])
        : name === "links"
            ? z.array(z.object({ name: z.string().optional(), url: z.string(), label: z.string().optional() }))
            : z.string();
    basicsShape[name] = type.describe(field.describe).optional();
}

const skillObjectSchema = entrySchema(SECTION_ENTRY_SPECS.skill);

const skillItemSchema = z.union([
    z.string().describe('A skill name; "TypeScript (expert)" also sets the level.'),
    skillObjectSchema,
]);

const skillGroupObjectSchema = z.object({
    group: z.string().describe("Group name."),
    skills: z.array(skillItemSchema),
    hidden: z.boolean().describe(HIDDEN.describe).optional(),
}).catchall(z.unknown());

const skillsSchema = z.union([
    z.array(z.union([skillItemSchema, skillGroupObjectSchema]))
        .describe("A flat list of skills (or of groups)."),
    z.record(z.string(), z.array(skillItemSchema))
        .describe('Skills by group name: { "Frontend": ["React", ...] }. The key "" holds ungrouped skills.'),
]);

const cefrLevel = z.string().describe('"A1" to "C2".').optional();

const languageObjectSchema = z.object({
    id: z.string().describe(ID.describe).optional(),
    language: z.string().describe("Language name."),
    level: z.string().describe('"A1"–"C2", "native", or a short description.').optional(),
    cefr: z.object({
        listening: cefrLevel,
        reading: cefrLevel,
        spokenInteraction: cefrLevel,
        spokenProduction: cefrLevel,
        writing: cefrLevel,
    }).describe("Per-skill CEFR self-assessment.").optional(),
    certificate: z.object({
        issuer: z.string().optional(),
        id: z.string().optional(),
        url: z.string().optional(),
    }).describe("A certificate that proves the level.").optional(),
    selfAssessed: z.boolean().describe("true when the level is a self-assessment.").optional(),
    description: z.string().describe("Short note.").optional(),
    hidden: z.boolean().describe(HIDDEN.describe).optional(),
}).catchall(z.unknown());

const languagesSchema = z.array(z.union([
    z.string().describe('"Language: level", e.g. "German: B2" or "Bosnian: native".'),
    languageObjectSchema,
]));

const interestsSchema = z.array(z.union([
    z.string().describe("An interest."),
    entrySchema(SECTION_ENTRY_SPECS.interests),
]));

const declarationEntrySchema = entrySchema(SECTION_ENTRY_SPECS.declaration);

const customSectionSchema = z.object({
    id: z.string().describe(ID.describe).optional(),
    title: z.string().describe("Section heading."),
    text: z.string().describe("Free text in Markdown (a text section).").optional(),
    tags: z.array(z.string()).describe("Short tags (a tag section).").optional(),
    entries: z.array(entrySchema(SECTION_ENTRY_SPECS.customEntry)).describe("Entries (an entry section).").optional(),
    hidden: z.boolean().describe(HIDDEN.describe).optional(),
}).catchall(z.unknown());

const designSchema = z.object({
    template: z.string().describe('An EngineCV template id, e.g. "enginecv-modern".').optional(),
    accent: z.string().describe('Accent colour as "#rrggbb".').optional(),
    cvLanguage: z.string().describe('Language of the CV headings, e.g. "en", "de", "bs".').optional(),
}).catchall(z.unknown());

export const authoringV1Schema = z.object({
    format: z.literal(AUTHORING_FORMAT).describe("Format marker. Always this exact value."),
    design: designSchema.describe("Optional design hints. Unknown values are ignored.").optional(),
    basics: z.object(basicsShape).catchall(z.unknown()).describe("Name, contact and personal details.").optional(),
    summary: z.string().describe("Profile summary in Markdown.").optional(),
    ...listEntrySchemas,
    declaration: z.union([declarationEntrySchema, z.array(declarationEntrySchema)])
        .describe("Signed declaration, as required by some employers.").optional(),
    skills: skillsSchema.optional(),
    languages: languagesSchema.optional(),
    interests: interestsSchema.optional(),
    custom: z.array(customSectionSchema).describe("Sections EngineCV has no name for.").optional(),
}).catchall(z.unknown());

export type AuthoringDocument = z.infer<typeof authoringV1Schema>;

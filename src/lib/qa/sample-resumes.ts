import { resumeSchema, type Resume } from "../schema";

/**
 * Standardised QA resumes.
 *
 * These are the fixtures every rendering, export and migration check is run
 * against, so a defect found by hand once can be pinned by a test afterwards.
 * They are deterministic — fixed ids, no `createId()`, no `Date.now()` — so two
 * calls deep-equal each other and a rendered document can be diffed across
 * commits.
 *
 * `createQaFullResume` is the one that matters: every content section carries
 * four entries in a fixed shape,
 *
 *   1. **complete** — every field of the schema populated,
 *   2. **sparse** — only the fields a user is likely to fill, so the layout is
 *      exercised with the rest missing,
 *   3. **awkward** — Markdown, non-Latin scripts, emoji and long unbroken
 *      strings, which is where shaping and overflow defects show up,
 *   4. **hidden** — `hidden: true`, which must never reach a rendered page.
 *
 * `sample-resumes.unit.test.ts` fails when a section is added to the schema and
 * not to the fixture, so "every content type" stays true rather than being true
 * on the day it was written.
 */

/** 8×8 PNG. Small enough to inline, real enough to travel the image path. */
const PNG_8PX =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSnc"
    + "AAAAEUlEQVR42mPY4qWCFTEMLQkAeGxIgT0mnm8AAAAASUVORK5CYII=";

/** A long word with no break opportunity — the classic column-overflow case. */
const UNBREAKABLE = "Kubernetes".repeat(6);

const MARKDOWN_BODY =
    "Led the **replication** rewrite and its [runbook](https://example.com/runbook).\n\n"
    + "- Cut p99 write latency from 240 ms to 38 ms.\n"
    + "- Moved 40 TB across regions with no read downtime.\n"
    + "- Added `property-based` tests for the *quorum* path.\n";

/** Mixed scripts and an emoji, to exercise the font fallback chain. */
const MULTISCRIPT = "Šehić-Đurić · Ελληνικά · Русский · 中文 · العربية · 🚀";

/**
 * Every hidden entry carries this string in its visible text. A rendered
 * document containing it is proof that a `hidden` flag was ignored somewhere.
 */
export const QA_HIDDEN_MARKER = "QAHIDDEN";

/**
 * Fixed timestamps. The schema defaults these to `Date.now()`, which would make
 * two calls differ and defeat diffing a rendered document across commits.
 */
const FIXED_TIMESTAMP = Date.UTC(2026, 0, 1, 12, 0, 0);

export const QA_CONTENT_SECTIONS = [
    "experience",
    "education",
    "courses",
    "certificates",
    "awards",
    "publications",
    "references",
    "declaration",
    "projects",
    "organisations",
    "interests",
    "languages",
    "skills",
] as const;

const CUSTOM_SECTION_IDS = {
    entries: "custom-entries",
    text: "custom-text",
    tags: "custom-tags",
} as const;

/**
 * Every section key the full fixture configures, custom sections included.
 * Rendering it must produce a block for each of these.
 */
export const QA_FULL_SECTION_KEYS: string[] = [
    ...QA_CONTENT_SECTIONS,
    `custom:${CUSTOM_SECTION_IDS.entries}`,
    `custom:${CUSTOM_SECTION_IDS.text}`,
    `custom:${CUSTOM_SECTION_IDS.tags}`,
];

function qaBasics() {
    return {
        name: "Amina Šehić-Đurić",
        headline: "Staff Software Engineer — Distributed Systems 🚀",
        photo: PNG_8PX,
        photoEdit: {
            original: PNG_8PX,
            crop: { x: 12, y: -4 },
            zoom: 1.4,
            rotation: 90,
            croppedAreaPixels: { x: 4, y: 4, width: 240, height: 240 },
        },
        email: "amina@example.com",
        emails: [
            { id: "email-1", email: "amina@example.com", label: "Work" },
            { id: "email-2", email: "amina.personal@example.org", label: "Personal" },
        ],
        phone: "+387 60 000 000",
        location: "Sarajevo, Bosnia & Herzegovina",
        website: "https://amina.example.com",
        drivingLicense: "B, BE",
        linkedin: "https://linkedin.com/in/amina",
        github: "https://github.com/amina",
        summary:
            "Engineer with a decade on storage and scheduling systems. Happiest where "
            + "correctness, latency and operability meet — and willing to write the "
            + "*runbook* nobody else wants to.",
        dateOfBirth: "1990-04-12",
        nationality: "BA",
        passportOrId: "passport",
        passport: "A1234567",
        nationalId: "1204990175021",
        maritalStatus: "Single",
        militaryService: "Not applicable",
        genderPronoun: "she/her",
        disability: "none",
        visa: "EU Blue Card",
        height: "172",
        detailsOrder: [
            "dateOfBirth", "nationality", "passport", "nationalId", "maritalStatus",
            "militaryService", "genderPronoun", "disability", "visa", "height",
            "drivingLicense",
        ],
        customLinks: [
            { id: "link-1", name: "Mastodon", url: "https://mastodon.social/@amina", label: "@amina", icon: "mastodon" },
            { id: "link-2", name: "Blog", url: "https://amina.example.com/blog", label: "", icon: "auto" },
            { id: "link-3", name: "Talks", url: "https://talks.example.com/amina", label: "Conference talks", icon: "auto" },
        ],
    };
}

function qaExperience() {
    return [
        {
            id: "exp-1",
            hidden: false,
            company: "Northwind Data",
            position: "Staff Engineer",
            start: "2021-03",
            end: "Present",
            location: "Remote",
            description: MARKDOWN_BODY,
            highlights: ["Owned the ingestion pipeline", "On-call lead for the storage rota"],
            skills: ["Rust", "Kubernetes", "PostgreSQL"],
            url: "https://northwind.example.com",
            urlIcon: "globe",
        },
        {
            id: "exp-2",
            hidden: false,
            company: "Meridian Systems",
            position: "Senior Engineer",
            start: "2018-01",
            end: "2021-02",
            location: "",
            description: "Built the scheduler that replaced a nightly cron fleet.",
            highlights: [],
            skills: [],
            url: "",
            urlIcon: "auto",
        },
        {
            id: "exp-3",
            hidden: false,
            company: `Институт ${UNBREAKABLE}`,
            position: MULTISCRIPT,
            start: "2016-06",
            end: "2017-12",
            location: "Sarajevo",
            description: "Research on *consistent hashing* under churn — see [the paper](https://example.org/paper).",
            highlights: ["Published two papers 📄"],
            skills: ["C++", UNBREAKABLE],
            url: "https://example.org",
            urlIcon: "auto",
        },
        {
            id: "exp-hidden",
            hidden: true,
            company: "QAHIDDEN Company",
            position: "QAHIDDEN Position",
            start: "2010-01",
            end: "2011-01",
            location: "Nowhere",
            description: "QAHIDDEN description — must never reach a rendered page.",
            highlights: [],
            skills: [],
            url: "",
            urlIcon: "auto",
        },
    ];
}

function qaEducation() {
    return [
        {
            id: "edu-1",
            hidden: false,
            institution: "University of Sarajevo",
            area: "Computer Science",
            studyType: "MSc",
            start: "2013-10",
            end: "2015-07",
            location: "Sarajevo",
            description: "Thesis on *consistent hashing* under churn.",
            score: "9.1/10",
            courses: ["Distributed Systems", "Compilers"],
            skills: ["Algorithms"],
            url: "https://unsa.ba",
            urlIcon: "graduation-cap",
        },
        {
            id: "edu-2",
            hidden: false,
            institution: "University of Sarajevo",
            area: "",
            studyType: "BSc Computer Science",
            start: "2010-10",
            end: "2013-07",
            location: "",
            description: "",
            score: "",
            courses: [],
            skills: [],
            url: "",
            urlIcon: "auto",
        },
        {
            id: "edu-3",
            hidden: false,
            institution: "Universität Wien 🇦🇹",
            area: "Mathematik",
            studyType: "Erasmus",
            start: "2012-10",
            end: "2013-02",
            location: "Wien",
            description: "Exchange semester — **Maßtheorie** and numerics.",
            score: "1,0",
            courses: [UNBREAKABLE],
            skills: [],
            url: "https://univie.ac.at",
            urlIcon: "auto",
        },
        {
            id: "edu-hidden",
            hidden: true,
            institution: "QAHIDDEN Academy",
            area: "",
            studyType: "",
            start: "",
            end: "",
            location: "",
            description: "",
            score: "",
            courses: [],
            skills: [],
            url: "",
            urlIcon: "auto",
        },
    ];
}

function qaCourses() {
    return [
        {
            id: "course-1",
            hidden: false,
            name: "Advanced Kubernetes Operations",
            institution: "Linux Foundation",
            start: "2022-01",
            end: "2022-04",
            location: "Online",
            description: "Operator patterns, `etcd` recovery, cluster upgrades.",
            skills: ["Kubernetes", "Go"],
            url: "https://training.linuxfoundation.org",
            urlIcon: "book",
        },
        {
            id: "course-2",
            hidden: false,
            name: "Rust for Systems Programmers",
            institution: "",
            start: "2020-09",
            end: "",
            location: "",
            description: "",
            skills: [],
            url: "",
            urlIcon: "auto",
        },
        {
            id: "course-3",
            hidden: false,
            name: `分散システム — ${MULTISCRIPT}`,
            institution: "東京大学",
            start: "2019-04",
            end: "2019-08",
            location: "東京",
            description: "Consensus, *failure detectors*, and the FLP result.",
            skills: ["Paxos"],
            url: "https://u-tokyo.ac.jp",
            urlIcon: "auto",
        },
        {
            id: "course-hidden",
            hidden: true,
            name: "QAHIDDEN Course",
            institution: "",
            start: "",
            end: "",
            location: "",
            description: "",
            skills: [],
            url: "",
            urlIcon: "auto",
        },
    ];
}

function qaCertificates() {
    return [
        {
            id: "cert-1",
            hidden: false,
            name: "Certified Kubernetes Administrator",
            date: "2022-05",
            issuer: "CNCF",
            description: "Credential ID `CKA-2022-0142`, valid three years.",
            skills: ["Kubernetes"],
            url: "https://cncf.io/verify/CKA-2022-0142",
            urlIcon: "badge-check",
            issuerUrl: "https://cncf.io",
            issuerUrlIcon: "globe",
        },
        {
            id: "cert-2",
            hidden: false,
            name: "AWS Solutions Architect",
            date: "2019-11",
            issuer: "Amazon Web Services",
            description: "",
            skills: [],
            url: "",
            urlIcon: "auto",
            issuerUrl: "",
            issuerUrlIcon: "auto",
        },
        {
            id: "cert-3",
            hidden: false,
            name: MULTISCRIPT,
            date: "",
            issuer: `Институт ${UNBREAKABLE}`,
            description: "No date — the layout must not leave a dangling separator.",
            skills: [UNBREAKABLE],
            url: "https://example.org/cert",
            urlIcon: "auto",
            issuerUrl: "https://example.org",
            issuerUrlIcon: "auto",
        },
        {
            id: "cert-hidden",
            hidden: true,
            name: "QAHIDDEN Certificate",
            date: "",
            issuer: "",
            description: "",
            skills: [],
            url: "",
            urlIcon: "auto",
            issuerUrl: "",
            issuerUrlIcon: "auto",
        },
    ];
}

function qaAwards() {
    return [
        {
            id: "award-1",
            hidden: false,
            name: "Engineering Excellence Award",
            issuer: "Northwind Data",
            date: "2023-12",
            description: "For the **zero-downtime** region migration.",
            skills: ["Rust"],
            url: "https://northwind.example.com/awards",
            urlIcon: "trophy",
        },
        {
            id: "award-2",
            hidden: false,
            name: "Hackathon Winner",
            issuer: "",
            date: "2017-06",
            description: "",
            skills: [],
            url: "",
            urlIcon: "auto",
        },
        {
            id: "award-3",
            hidden: false,
            name: `Награда — ${MULTISCRIPT}`,
            issuer: "Академија",
            date: "2015-03",
            description: "Citation in *Cyrillic*, to check shaping in emphasis.",
            skills: [],
            url: "",
            urlIcon: "auto",
        },
        {
            id: "award-hidden",
            hidden: true,
            name: "QAHIDDEN Award",
            issuer: "",
            date: "",
            description: "",
            skills: [],
            url: "",
            urlIcon: "auto",
        },
    ];
}

function qaPublications() {
    return [
        {
            id: "pub-1",
            hidden: false,
            name: "Consistent Hashing Under Churn",
            publisher: "ACM SIGOPS",
            date: "2015-09",
            description: "DOI [10.1145/example](https://doi.org/10.1145/example), cited 42 times.",
            skills: ["Distributed Systems"],
            url: "https://doi.org/10.1145/example",
            urlIcon: "file-text",
        },
        {
            id: "pub-2",
            hidden: false,
            name: "A Note on Quorum Reads",
            publisher: "",
            date: "2016-02",
            description: "",
            skills: [],
            url: "",
            urlIcon: "auto",
        },
        {
            id: "pub-3",
            hidden: false,
            name: MULTISCRIPT,
            publisher: "东京大学出版会",
            date: "",
            description: `Very long title handling: ${UNBREAKABLE}`,
            skills: [],
            url: "https://example.org/pub",
            urlIcon: "auto",
        },
        {
            id: "pub-hidden",
            hidden: true,
            name: "QAHIDDEN Publication",
            publisher: "",
            date: "",
            description: "",
            skills: [],
            url: "",
            urlIcon: "auto",
        },
    ];
}

function qaReferences() {
    return [
        {
            id: "ref-1",
            hidden: false,
            name: "Dr. Lejla Hodžić",
            position: "Principal Engineer",
            organisation: "Northwind Data",
            email: "lejla@example.com",
            phone: "+387 61 111 111",
            description: "Direct manager for three years — available on request.",
            url: "https://linkedin.com/in/lejla",
            urlIcon: "linkedin",
        },
        {
            id: "ref-2",
            hidden: false,
            name: "Marco Rossi",
            position: "CTO",
            organisation: "",
            email: "",
            phone: "",
            description: "",
            url: "",
            urlIcon: "auto",
        },
        {
            id: "ref-3",
            hidden: false,
            name: MULTISCRIPT,
            position: "教授",
            organisation: "東京大学",
            email: "sensei@example.jp",
            phone: "+81 3 0000 0000",
            description: "Thesis supervisor.",
            url: "",
            urlIcon: "auto",
        },
        {
            id: "ref-hidden",
            hidden: true,
            name: "QAHIDDEN Reference",
            position: "",
            organisation: "",
            email: "",
            phone: "",
            description: "",
            url: "",
            urlIcon: "auto",
        },
    ];
}

function qaDeclaration() {
    return [
        {
            id: "decl-1",
            hidden: false,
            text: "I declare that the information given above is true to the best of my knowledge.",
            signature: PNG_8PX,
            fullName: "Amina Šehić-Đurić",
            place: "Sarajevo",
            date: "2026-08-17",
        },
        {
            id: "decl-2",
            hidden: false,
            text: "Signed without an image signature.",
            signature: "",
            fullName: "Amina Šehić-Đurić",
            place: "",
            date: "",
        },
        {
            id: "decl-3",
            hidden: false,
            text: `Izjavljujem — ${MULTISCRIPT}`,
            signature: "",
            fullName: MULTISCRIPT,
            place: "Сарајево",
            date: "17.08.2026.",
        },
        {
            id: "decl-hidden",
            hidden: true,
            text: "QAHIDDEN declaration.",
            signature: "",
            fullName: "",
            place: "",
            date: "",
        },
    ];
}

function qaProjects() {
    return [
        {
            id: "proj-1",
            hidden: false,
            name: "Tracepipe",
            subtitle: "Open source",
            description: "Distributed tracing for batch jobs, with a `jq`-shaped query language.",
            highlights: ["1.2k stars", "Used in three production fleets"],
            keywords: ["tracing", "observability"],
            skills: ["Go", "gRPC"],
            start: "2020-02",
            end: "Present",
            url: "https://github.com/amina/tracepipe",
            urlIcon: "github",
            repos: [
                { id: "repo-1", url: "https://github.com/amina/tracepipe", platform: "github", label: "Source" },
                { id: "repo-2", url: "https://gitlab.com/amina/tracepipe-mirror", platform: "gitlab", label: "Mirror" },
            ],
            icon: "terminal",
            visibility: "public" as const,
        },
        {
            id: "proj-2",
            hidden: false,
            name: "kvbench",
            subtitle: "",
            description: "A small benchmark harness for key-value stores.",
            highlights: [],
            keywords: [],
            skills: [],
            start: "",
            end: "",
            url: "",
            urlIcon: "auto",
            repos: [],
        },
        {
            id: "proj-3",
            hidden: false,
            name: `プロジェクト ${MULTISCRIPT}`,
            subtitle: UNBREAKABLE,
            description: "**Bold** and *italic* mixed with 中文 in one line.",
            highlights: [MULTISCRIPT],
            keywords: [UNBREAKABLE],
            skills: ["Rust"],
            start: "2018-05",
            end: "2019-01",
            url: "https://example.org/project",
            urlIcon: "auto",
            repos: [{ id: "repo-3", url: "https://codeberg.org/amina/p", platform: "auto", label: "" }],
        },
        {
            id: "proj-hidden",
            hidden: true,
            name: "QAHIDDEN Project",
            subtitle: "",
            description: "",
            highlights: [],
            keywords: [],
            skills: [],
            start: "",
            end: "",
            url: "",
            urlIcon: "auto",
            repos: [],
        },
    ];
}

function qaOrganisations() {
    return [
        {
            id: "org-1",
            hidden: false,
            name: "Bosnian Open Source Society",
            role: "Board member",
            start: "2019-01",
            end: "Present",
            location: "Sarajevo",
            description: "Runs the annual **FOSS BA** conference.",
            skills: ["Community"],
            url: "https://foss.ba",
            urlIcon: "users",
        },
        {
            id: "org-2",
            hidden: false,
            name: "IEEE",
            role: "Member",
            start: "2015-01",
            end: "",
            location: "",
            description: "",
            skills: [],
            url: "",
            urlIcon: "auto",
        },
        {
            id: "org-3",
            hidden: false,
            name: MULTISCRIPT,
            role: "Волонтер",
            start: "2014-01",
            end: "2015-12",
            location: "Сарајево",
            description: "Cyrillic role title with a Latin organisation name.",
            skills: [],
            url: "",
            urlIcon: "auto",
        },
        {
            id: "org-hidden",
            hidden: true,
            name: "QAHIDDEN Organisation",
            role: "",
            start: "",
            end: "",
            location: "",
            description: "",
            skills: [],
            url: "",
            urlIcon: "auto",
        },
    ];
}

function qaInterests() {
    return [
        { id: "int-1", hidden: false, name: "Bouldering", description: "Outdoor, grade 6b+." },
        { id: "int-2", hidden: false, name: "Analogue photography", description: "" },
        { id: "int-3", hidden: false, name: MULTISCRIPT, description: "Emoji and mixed scripts in one entry 🚀" },
        { id: "int-hidden", hidden: true, name: "QAHIDDEN Interest", description: "" },
    ];
}

function qaLanguages() {
    return [
        {
            id: "lang-1",
            hidden: false,
            language: "Bosnian",
            fluency: "Native",
            // The schema strips assessment fields for native fluency; they are set
            // here on purpose so the fixture proves that transform still runs.
            assessmentType: "issuer",
            issuer: "Should be stripped",
            assessmentId: "STRIPPED",
            assessmentUrl: "https://example.com/stripped",
            description: "Mother tongue.",
        },
        {
            id: "lang-2",
            hidden: false,
            language: "English",
            fluency: "C2",
            assessmentType: "issuer",
            issuer: "Cambridge Assessment",
            assessmentId: "CPE-2014-8891",
            assessmentUrl: "https://cambridgeenglish.org/verify/CPE-2014-8891",
            description: "Certificate of Proficiency in English.",
        },
        {
            id: "lang-3",
            hidden: false,
            language: "Deutsch",
            fluency: "B2",
            assessmentType: "self",
            issuer: "",
            assessmentId: "",
            assessmentUrl: "",
            description: "",
        },
        {
            id: "lang-4",
            hidden: false,
            language: "日本語",
            fluency: "A2",
            assessmentType: "none",
            issuer: "",
            assessmentId: "",
            assessmentUrl: "",
            description: "Conversational only.",
        },
        {
            id: "lang-hidden",
            hidden: true,
            language: "QAHIDDEN Language",
            fluency: "C1",
            assessmentType: "none",
            issuer: "",
            assessmentId: "",
            assessmentUrl: "",
            description: "",
        },
    ];
}

function qaSkillGroups() {
    return [
        {
            id: "ungrouped",
            name: "",
            hidden: false,
            skills: [
                {
                    id: "skill-1", hidden: false, name: "Rust", description: "Systems and tooling.",
                    level: "expert", icon: "rust", display: "both", keywords: ["tokio", "serde"],
                },
                {
                    id: "skill-2", hidden: false, name: "Go", description: "",
                    level: "proficient", icon: "auto", display: "name", keywords: [],
                },
            ],
        },
        {
            id: "group-infra",
            name: "Infrastructure",
            hidden: false,
            skills: [
                {
                    id: "skill-3", hidden: false, name: "Kubernetes", description: "Operators and upgrades.",
                    level: "competent", icon: "kubernetes", display: "icon", keywords: ["helm"],
                },
                {
                    id: "skill-4", hidden: false, name: "Terraform", description: "",
                    level: "amateur", icon: "auto", display: "both", keywords: [],
                },
                {
                    id: "skill-5", hidden: false, name: "Nix", description: "",
                    level: "beginner", icon: "auto", display: "both", keywords: [],
                },
                // No level at all: the bar/dot renderers must cope with "".
                {
                    id: "skill-6", hidden: false, name: UNBREAKABLE, description: "",
                    level: "", icon: "auto", display: "both", keywords: [],
                },
                {
                    id: "skill-hidden", hidden: true, name: "QAHIDDEN Skill", description: "",
                    level: "expert", icon: "auto", display: "both", keywords: [],
                },
            ],
        },
        {
            id: "group-multiscript",
            name: MULTISCRIPT,
            hidden: false,
            skills: [
                {
                    id: "skill-7", hidden: false, name: "中文输入", description: "",
                    level: "competent", icon: "auto", display: "both", keywords: [],
                },
            ],
        },
    ];
}

function qaCustomSections() {
    return [
        {
            id: CUSTOM_SECTION_IDS.entries,
            hidden: false,
            title: "Volunteering",
            icon: "heart",
            layout: "entries",
            text: "",
            tags: [],
            entries: [
                {
                    id: "custom-entry-1", hidden: false, title: "Mentor",
                    subtitle: "Code for BiH", start: "2021-01", end: "Present",
                    location: "Sarajevo", description: "Mentored **eight** juniors through their first year.",
                    skills: ["Mentoring"], url: "https://codeforbih.example.org", urlIcon: "heart",
                },
                {
                    id: "custom-entry-2", hidden: false, title: "Translator",
                    subtitle: "", start: "2020-06", end: "",
                    location: "", description: "", skills: [], url: "", urlIcon: "auto",
                },
                {
                    id: "custom-entry-3", hidden: false, title: MULTISCRIPT,
                    subtitle: UNBREAKABLE, start: "", end: "",
                    location: "Сарајево", description: "Mixed scripts inside a custom entry.",
                    skills: [], url: "", urlIcon: "auto",
                },
                {
                    id: "custom-entry-hidden", hidden: true, title: "QAHIDDEN Custom Entry",
                    subtitle: "", start: "", end: "", location: "", description: "",
                    skills: [], url: "", urlIcon: "auto",
                },
            ],
        },
        {
            id: CUSTOM_SECTION_IDS.text,
            hidden: false,
            title: "Statement",
            icon: "auto",
            layout: "text",
            text:
                "A free-text section with **Markdown**, a [link](https://example.com), "
                + `a long token (${UNBREAKABLE}) and mixed scripts (${MULTISCRIPT}).\n\n`
                + "- and a list item, to check that the text layout renders block content\n",
            tags: [],
            entries: [],
        },
        {
            id: CUSTOM_SECTION_IDS.tags,
            hidden: false,
            title: "Tooling",
            icon: "wrench",
            layout: "tags",
            text: "",
            tags: ["Neovim", "tmux", "ripgrep", MULTISCRIPT, UNBREAKABLE],
            entries: [],
        },
    ];
}

/**
 * The kitchen-sink fixture: every content section, four entries each, every
 * schema field populated at least once.
 */
export function createQaFullResume(): Resume {
    return resumeSchema.parse({
        id: "qa-full",
        version: 1,
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
        meta: {
            title: "QA — Full Coverage",
            description: "Every content section with complete, sparse, awkward and hidden entries.",
            tags: ["qa", "fixture", "full"],
        },
        basics: qaBasics(),
        experience: qaExperience(),
        education: qaEducation(),
        courses: qaCourses(),
        certificates: qaCertificates(),
        awards: qaAwards(),
        publications: qaPublications(),
        references: qaReferences(),
        declaration: qaDeclaration(),
        projects: qaProjects(),
        organisations: qaOrganisations(),
        interests: qaInterests(),
        languages: qaLanguages(),
        skillGroups: qaSkillGroups(),
        customSections: qaCustomSections(),
        settings: {
            language: "en",
            dateFormat: "MMM YYYY",
            measurementSystem: "metric",
            contentSections: QA_FULL_SECTION_KEYS,
            hiddenSections: [],
            layout: { sectionOrder: QA_FULL_SECTION_KEYS },
        },
    });
}

/**
 * The empty-state fixture: a name and nothing else. Anything that renders,
 * exports or thumbnails a resume has to survive this without an empty heading,
 * a stray separator or a divide-by-zero in a layout measurement.
 */
export function createQaMinimalResume(): Resume {
    return resumeSchema.parse({
        id: "qa-minimal",
        version: 1,
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
        meta: { title: "QA — Minimal", description: "Name only.", tags: ["qa", "fixture", "minimal"] },
        basics: { name: "Minimal Person" },
        settings: { contentSections: [], layout: { sectionOrder: [] } },
    });
}

/**
 * The awkward-data fixture: everything that is individually legal and jointly
 * hostile — sections whose every entry is hidden, custom sections that are
 * empty in their own layout mode, open-ended and inverted date ranges, and a
 * skill list long enough to wrap several times.
 */
export function createQaEdgeCaseResume(): Resume {
    const manySkills = Array.from({ length: 40 }, (_, index) => ({
        id: `edge-skill-${index}`,
        hidden: false,
        name: index % 7 === 0 ? `${UNBREAKABLE}-${index}` : `Skill ${index}`,
        description: "",
        level: index % 3 === 0 ? "expert" : "",
        icon: "auto",
        display: "both",
        keywords: [],
    }));

    return resumeSchema.parse({
        id: "qa-edge",
        version: 1,
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
        meta: { title: "QA — Edge Cases", description: "Hostile but legal data.", tags: ["qa", "fixture", "edge"] },
        basics: {
            // No name at all — the header must not render an empty block.
            name: "",
            headline: UNBREAKABLE,
            email: "",
            summary: "",
            // A photo edit with no photo behind it.
            photo: "",
            photoEdit: {
                original: "", crop: { x: 0, y: 0 }, zoom: 1, rotation: 0,
                croppedAreaPixels: { x: 0, y: 0, width: 0, height: 0 },
            },
            customLinks: [{ id: "edge-link-1", name: "", url: "example.com", label: "", icon: "auto" }],
        },
        experience: [
            // Every entry hidden: the section heading must not render either.
            { id: "edge-exp-1", hidden: true, company: "QAHIDDEN Co", position: "QAHIDDEN Position" },
            { id: "edge-exp-2", hidden: true, company: "QAHIDDEN Co 2", position: "QAHIDDEN Position" },
        ],
        education: [
            // End before start, and a start with no end.
            { id: "edge-edu-1", institution: "Reversed Dates University", start: "2020-01", end: "2015-01" },
            { id: "edge-edu-2", institution: "Open Ended College", start: "2019-01", end: "" },
            { id: "edge-edu-3", institution: "No Dates School", start: "", end: "" },
        ],
        skillGroups: [
            { id: "ungrouped", name: "", hidden: false, skills: manySkills },
            // A group with no skills at all, and one hidden entirely.
            { id: "edge-empty-group", name: "Empty Group", hidden: false, skills: [] },
            {
                id: "edge-hidden-group", name: "QAHIDDEN Group", hidden: true,
                skills: [{ id: "edge-hidden-skill", hidden: false, name: "QAHIDDEN Invisible" }],
            },
        ],
        customSections: [
            // Empty in its own layout mode — each of these must render nothing.
            { id: "edge-custom-entries", title: "No Entries", layout: "entries", entries: [] },
            { id: "edge-custom-text", title: "Blank Text", layout: "text", text: "   " },
            { id: "edge-custom-tags", title: "Blank Tags", layout: "tags", tags: ["", "  "] },
        ],
        settings: {
            contentSections: [
                "experience", "education", "skills",
                "custom:edge-custom-entries", "custom:edge-custom-text", "custom:edge-custom-tags",
            ],
            layout: {
                sectionOrder: [
                    "experience", "education", "skills",
                    "custom:edge-custom-entries", "custom:edge-custom-text", "custom:edge-custom-tags",
                ],
            },
        },
    });
}

export interface QaResumeFixture {
    id: string;
    label: string;
    create: () => Resume;
}

/** Every QA fixture, in the order a manual pass should walk them. */
export const QA_RESUME_FIXTURES: QaResumeFixture[] = [
    { id: "qa-full", label: "QA — Full Coverage", create: createQaFullResume },
    { id: "qa-minimal", label: "QA — Minimal", create: createQaMinimalResume },
    { id: "qa-edge", label: "QA — Edge Cases", create: createQaEdgeCaseResume },
];

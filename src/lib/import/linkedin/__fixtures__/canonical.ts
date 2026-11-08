import { csvFromRows, zipFileFromEntries } from "./archive-builder";

export const PROFILE_HEADERS = [
    "First Name",
    "Last Name",
    "Maiden Name",
    "Address",
    "Birth Date",
    "Headline",
    "Summary",
    "Industry",
    "Zip Code",
    "Geo Location",
    "Twitter Handles",
    "Websites",
    "Instant Messengers",
];

export const POSITIONS_HEADERS = ["Company Name", "Title", "Description", "Location", "Started On", "Finished On"];
export const EDUCATION_HEADERS = ["School Name", "Start Date", "End Date", "Notes", "Degree Name", "Activities"];
export const SKILLS_HEADERS = ["Name"];
export const CERTIFICATIONS_HEADERS = ["Name", "Url", "Authority", "Started On", "Finished On", "License Number"];
export const LANGUAGES_HEADERS = ["Name", "Proficiency"];
export const PROJECTS_HEADERS = ["Title", "Description", "Url", "Started On", "Finished On"];

export const canonicalProfileRow = {
    "First Name": "Amina",
    "Last Name": "Kovačević",
    Headline: "Senior Software Engineer",
    Summary: "Builder of local-first tools.\nLoves privacy, performance, and \"boring\" tech.",
    Industry: "Computer Software",
    "Geo Location": "Sarajevo, Bosnia and Herzegovina",
    Websites: "[PERSONAL:https://amina.dev,PORTFOLIO:https://github.com/aminak]",
};

export const canonicalPositionRows = [
    {
        "Company Name": "EngineWorks",
        Title: "Senior Software Engineer",
        Description: "Own the resume editor.\nShipped offline exports, cut render time 40%.",
        Location: "Sarajevo, Bosnia and Herzegovina",
        "Started On": "Feb 2022",
        "Finished On": "",
    },
    {
        "Company Name": "WebShop d.o.o.",
        Title: "Frontend Developer",
        Description: "Storefront features, checkout flow, A/B testing.",
        Location: "Remote",
        "Started On": "Jan 2019",
        "Finished On": "Dec 2021",
    },
];

export const canonicalEducationRows = [
    {
        "School Name": "University of Sarajevo",
        "Start Date": "Sep 2014",
        "End Date": "Jun 2018",
        Notes: "Thesis on distributed systems.",
        "Degree Name": "Bachelor of Science, Computer Science",
        Activities: "ACM student chapter",
    },
];

export const canonicalSkillRows = [{ Name: "TypeScript" }, { Name: "React" }, { Name: "C++" }];

export const canonicalCertificationRows = [
    {
        Name: "AWS Certified Developer – Associate",
        Url: "https://aws.amazon.com/verification",
        Authority: "Amazon Web Services",
        "Started On": "Mar 2022",
        "Finished On": "Mar 2025",
        "License Number": "ABC-123",
    },
];

export const canonicalLanguageRows = [
    { Name: "Bosnian", Proficiency: "Native or bilingual proficiency" },
    { Name: "English", Proficiency: "Full professional proficiency" },
];

export const canonicalProjectRows = [
    {
        Title: "EngineCV",
        Description: "Local-first resume builder.",
        Url: "https://enginecv.example",
        "Started On": "2023",
        "Finished On": "",
    },
];

export function canonicalCsvEntries(): Record<string, string> {
    return {
        "Profile.csv": csvFromRows(PROFILE_HEADERS, [canonicalProfileRow]),
        "Positions.csv": csvFromRows(POSITIONS_HEADERS, canonicalPositionRows),
        "Education.csv": csvFromRows(EDUCATION_HEADERS, canonicalEducationRows),
        "Skills.csv": csvFromRows(SKILLS_HEADERS, canonicalSkillRows),
        "Certifications.csv": csvFromRows(CERTIFICATIONS_HEADERS, canonicalCertificationRows),
        "Languages.csv": csvFromRows(LANGUAGES_HEADERS, canonicalLanguageRows),
        "Projects.csv": csvFromRows(PROJECTS_HEADERS, canonicalProjectRows),
    };
}

/** Complete archive with folder prefix, as LinkedIn ships it. */
export function canonicalArchiveFile(): File {
    const entries: Record<string, string> = {};
    for (const [name, text] of Object.entries(canonicalCsvEntries())) {
        entries[`Basic_LinkedInDataExport_01-01-2026/${name}`] = text;
    }
    return zipFileFromEntries(entries);
}

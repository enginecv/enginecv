import { CEFR_SKILLS, type CefrSkill } from "@/lib/cefr";
import { EuropassImportError } from "./errors";
import { europassHtmlToMarkdown } from "./html-to-markdown";

/**
 * Reads both Europass CV XML generations into one normalized model:
 *
 * - `Candidate` — the current Europass platform (2020+), built on HR-Open /
 *   EURES with `hr:`, `oa:` and `eures:` namespaces.
 * - `SkillsPassport` — the legacy Europass CV schema v3.x (until 2020).
 *
 * Elements are matched by local name only. Real files move elements between
 * the four namespaces across versions, so prefixes are not a stable contract.
 */

export type EuropassFormat = "europass" | "legacy";


export type EuropassLinkKind = "website" | "linkedin" | "github" | "other";

export interface EuropassLink {
    url: string;
    kind: EuropassLinkKind;
    label: string;
}

export interface EuropassPerson {
    givenName: string;
    familyName: string;
    headline: string;
    summary: string;
    emails: string[];
    phones: string[];
    location: string;
    links: EuropassLink[];
    dateOfBirth: string;
    /** ISO 3166-1 alpha-2, upper case, when the file carries a code. */
    nationality: string;
    /** `data:image/...` URL, or "". */
    photo: string;
    drivingLicences: string[];
}

export interface EuropassExperience {
    organisation: string;
    position: string;
    start: string;
    end: string;
    location: string;
    description: string;
    url: string;
}

export interface EuropassEducation {
    organisation: string;
    qualification: string;
    field: string;
    start: string;
    end: string;
    location: string;
    description: string;
    score: string;
    url: string;
}

export interface EuropassLanguage {
    name: string;
    native: boolean;
    levels: Partial<Record<CefrSkill, string>>;
    certificates: string[];
}

export interface EuropassActivity {
    title: string;
    start: string;
    end: string;
    location: string;
    description: string;
    url: string;
}

export interface EuropassCertification {
    name: string;
    issuer: string;
    date: string;
    description: string;
    url: string;
}

export interface EuropassPublication {
    title: string;
    publisher: string;
    date: string;
    description: string;
    url: string;
}

export interface EuropassReference {
    name: string;
    position: string;
    email: string;
    phone: string;
    description: string;
}

export interface EuropassActivitySection {
    title: string;
    entries: EuropassActivity[];
}

export interface EuropassTextSection {
    title: string;
    text: string;
}

export interface ParsedEuropassCv {
    format: EuropassFormat;
    /** Language the CV content is written in, e.g. "en". */
    locale: string;
    person: EuropassPerson;
    experience: EuropassExperience[];
    education: EuropassEducation[];
    languages: EuropassLanguage[];
    skills: string[];
    projects: EuropassActivity[];
    courses: EuropassActivity[];
    certifications: EuropassCertification[];
    publications: EuropassPublication[];
    references: EuropassReference[];
    interests: EuropassActivity[];
    activitySections: EuropassActivitySection[];
    textSections: EuropassTextSection[];
}

// ---------------------------------------------------------------------------
// DOM helpers (namespace-agnostic)

function kids(element: Element | null | undefined, name: string): Element[] {
    if (!element) return [];
    return Array.from(element.children).filter((child) => child.localName === name);
}

function kid(element: Element | null | undefined, name: string): Element | null {
    return kids(element, name)[0] ?? null;
}

function at(element: Element | null | undefined, path: string): Element | null {
    let current: Element | null = element ?? null;
    for (const name of path.split("/")) {
        current = kid(current, name);
        if (!current) return null;
    }
    return current;
}

function allAt(element: Element | null | undefined, path: string): Element[] {
    let current: Element[] = element ? [element] : [];
    for (const name of path.split("/")) {
        current = current.flatMap((node) => kids(node, name));
    }
    return current;
}

function text(element: Element | null | undefined, path?: string): string {
    const target = path ? at(element, path) : element;
    return (target?.textContent ?? "").trim();
}

function firstText(element: Element | null | undefined, paths: string[]): string {
    for (const path of paths) {
        const value = text(element, path);
        if (value) return value;
    }
    return "";
}

function isTrue(value: string): boolean {
    return value.trim().toLowerCase() === "true";
}

function joinNonEmpty(parts: string[], separator: string): string {
    return parts.map((part) => part.trim()).filter(Boolean).join(separator);
}

function unique(values: string[]): string[] {
    return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

// ---------------------------------------------------------------------------
// Value normalization

function displayName(code: string, locale: string, type: "language" | "region"): string {
    const trimmed = code.trim();
    if (!trimmed) return "";
    try {
        const names = new Intl.DisplayNames([locale, "en"], { type });
        const value = names.of(type === "region" ? trimmed.toUpperCase() : trimmed.toLowerCase());
        return value && value.toLowerCase() !== trimmed.toLowerCase() ? value : trimmed;
    } catch {
        return trimmed;
    }
}

/** "2021-06-06T10:00:00" → "2021-06"; "2016" → "2016". Anything else → "". */
export function normalizeEuropassDate(value: string): string {
    const match = /^(\d{4})(?:-(\d{2}))?/.exec(value.trim());
    if (!match) return "";
    return match[2] ? `${match[1]}-${match[2]}` : match[1];
}

/** Legacy `<From year="2005" month="--10" day="---10"/>`. */
function legacyDate(element: Element | null, withDay = false): string {
    if (!element) return "";
    const year = (element.getAttribute("year") ?? "").replace(/\D/g, "");
    if (year.length !== 4) return "";
    const month = (element.getAttribute("month") ?? "").replace(/\D/g, "");
    const day = (element.getAttribute("day") ?? "").replace(/\D/g, "");
    if (!month) return year;
    const monthPart = `${year}-${month.padStart(2, "0")}`;
    return withDay && day ? `${monthPart}-${day.padStart(2, "0")}` : monthPart;
}

function normalizeUrl(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
    return /^[\w-]+(\.[\w-]+)+/.test(trimmed) ? `https://${trimmed}` : "";
}

function linkKind(url: string): EuropassLinkKind {
    let host = "";
    try {
        host = new URL(url).hostname.toLowerCase();
    } catch {
        return "website";
    }
    // Match profile hosts only: a github.io page is a personal website.
    if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
    if (host === "github.com" || host === "www.github.com") return "github";
    return "website";
}

function base64ToText(value: string): string {
    try {
        return atob(value.replace(/\s+/g, ""));
    } catch {
        return "";
    }
}

/**
 * Europass stores the photo as base64 of a complete data URL
 * ("data:image/png;base64,..."); older files hold raw image base64 plus a
 * MIME type. Both come back as a data URL the editor can display.
 */
function photoDataUrl(data: string, mimeType = ""): string {
    const compact = data.replace(/\s+/g, "");
    if (!compact) return "";
    if (compact.startsWith("data:image/")) return compact;

    const decoded = base64ToText(compact);
    if (decoded.startsWith("data:image/")) {
        // Europass labels JPEG photos as image/png; trust the bytes instead.
        const url = decoded.replace(/\s+/g, "");
        const payload = url.slice(url.indexOf(",") + 1);
        const sniffed = payload.startsWith("/9j/") ? "image/jpeg" : payload.startsWith("iVBOR") ? "image/png" : "";
        return sniffed ? `data:${sniffed};base64,${payload}` : url;
    }

    const signature = decoded.slice(0, 4);
    const mime = /^image\/(png|jpe?g|gif|webp)$/i.test(mimeType)
        ? mimeType.toLowerCase()
        : signature.startsWith("\x89PNG") ? "image/png"
        : signature.startsWith("\xff\xd8") ? "image/jpeg"
        : signature.startsWith("GIF8") ? "image/gif"
        : "";
    return mime ? `data:${mime};base64,${compact}` : "";
}

function markdown(element: Element | null | undefined, path?: string): string {
    return europassHtmlToMarkdown(text(element, path));
}

function emptyPerson(): EuropassPerson {
    return {
        givenName: "",
        familyName: "",
        headline: "",
        summary: "",
        emails: [],
        phones: [],
        location: "",
        links: [],
        dateOfBirth: "",
        nationality: "",
        photo: "",
        drivingLicences: [],
    };
}

function emptyCv(format: EuropassFormat, locale: string): ParsedEuropassCv {
    return {
        format,
        locale,
        person: emptyPerson(),
        experience: [],
        education: [],
        languages: [],
        skills: [],
        projects: [],
        courses: [],
        certifications: [],
        publications: [],
        references: [],
        interests: [],
        activitySections: [],
        textSections: [],
    };
}

// ---------------------------------------------------------------------------
// Current Europass (Candidate)

const CEF_DIMENSIONS: Record<string, CefrSkill> = {
    "cef-understanding-listening": "listening",
    "cef-understanding-reading": "reading",
    "cef-speaking-interaction": "spokenInteraction",
    "cef-speaking-production": "spokenProduction",
    "cef-writing-production": "writing",
};

const ACTIVITY_SECTIONS: Array<{ container: string; title: string }> = [
    { container: "ConferencesAndSeminars", title: "Conferences and seminars" },
    { container: "VoluntaryWorks", title: "Volunteering" },
    { container: "NetworksAndMemberships", title: "Networks and memberships" },
    { container: "SocialAndPoliticalActivities", title: "Social and political activities" },
    { container: "CreativeWorks", title: "Creative works" },
    { container: "SpeakingHistory", title: "Speaking engagements" },
];

const TEXT_SKILL_SECTIONS: Array<{ container: string; title: string }> = [
    { container: "CommunicationAndInterpersonalSkills", title: "Communication and interpersonal skills" },
    { container: "ManagementAndLeadershipSkills", title: "Management and leadership skills" },
    { container: "OrganisationalSkills", title: "Organisational skills" },
    { container: "DigitalSkills", title: "Digital skills" },
];

function addressLocation(address: Element | null, locale: string): string {
    if (!address) return "";
    return joinNonEmpty([text(address, "CityName"), displayName(text(address, "CountryCode"), locale, "region")], ", ");
}

function organisationContact(owner: Element, locale: string): { location: string; url: string } {
    const communications = allAt(owner, "OrganizationContact/Communication");
    const address = communications.map((communication) => kid(communication, "Address")).find(Boolean) ?? null;
    const web = communications.find((communication) => text(communication, "ChannelCode").toLowerCase() === "web");
    return {
        location: addressLocation(address, locale),
        url: normalizeUrl(text(web, "URI")),
    };
}

function period(container: Element | null, currentFlag: string): { start: string; end: string } {
    const start = normalizeEuropassDate(text(container, "StartDate/FormattedDateTime") || text(container, "StartDate"));
    const current = isTrue(text(container, currentFlag));
    const end = current ? "Present" : normalizeEuropassDate(text(container, "EndDate/FormattedDateTime") || text(container, "EndDate"));
    return { start, end };
}

function readActivity(element: Element, locale: string): EuropassActivity {
    const dates = kid(element, "Date") ?? element;
    const { start, end } = period(dates, "Ongoing");
    return {
        title: firstText(element, ["Title", "Name", "CertificationName", "OrganizationName", "CompetencyName"]),
        start,
        end,
        location: firstText(element, ["Location", "City"]) || addressLocation(at(element, "Address"), locale),
        description: markdown(element, "Description"),
        url: normalizeUrl(text(element, "Link")),
    };
}

function readEntries(profile: Element | null, container: string, locale: string): EuropassActivity[] {
    return kids(profile, container)
        .flatMap((section) => Array.from(section.children).filter((child) => child.localName !== "Title"))
        .map((element) => readActivity(element, locale))
        .filter((entry) => entry.title || entry.description);
}

/** Europass repeats a section wrapper per item, so same-titled sections merge. */
function addActivitySection(cv: ParsedEuropassCv, title: string, entries: EuropassActivity[]): void {
    if (entries.length === 0) return;
    const existing = cv.activitySections.find((section) => section.title.toLowerCase() === title.toLowerCase());
    if (existing) existing.entries.push(...entries);
    else cv.activitySections.push({ title, entries });
}

function readCandidatePerson(person: Element | null, profile: Element | null, locale: string): EuropassPerson {
    const result = emptyPerson();
    if (!person) return result;

    result.givenName = text(person, "PersonName/GivenName");
    result.familyName = text(person, "PersonName/FamilyName");
    result.dateOfBirth = text(person, "BirthDate");
    result.nationality = text(person, "NationalityCode").toUpperCase();
    result.summary = markdown(profile, "ExecutiveSummary");

    for (const communication of kids(person, "Communication")) {
        const channel = text(communication, "ChannelCode").toLowerCase();
        const useCode = text(communication, "UseCode");
        const uri = text(communication, "URI");
        const address = kid(communication, "Address");

        if (address && !result.location) {
            result.location = addressLocation(address, locale);
        }

        if (channel === "email" && uri) {
            result.emails.push(uri.replace(/^mailto:/i, ""));
        } else if (channel.includes("telephone") || channel === "phone") {
            const number = text(communication, "DialNumber") || text(communication, "FormattedNumber") || uri;
            const dialing = text(communication, "CountryDialing").replace(/^\+/, "");
            if (number) result.phones.push(dialing ? `+${dialing} ${number}` : number);
        } else if (uri) {
            const url = normalizeUrl(uri);
            if (!/^https?:/i.test(url)) continue;
            const kind = linkKind(url);
            result.links.push({ url, kind, label: text(communication, "OtherTitle") || useCode });
        }
    }

    for (const license of allAt(profile, "Licenses/License")) {
        const code = text(license, "LicenseTypeCode") || text(license, "LicenseName");
        if (code) result.drivingLicences.push(code);
    }

    for (const attachment of kids(profile, "Attachment")) {
        const isPhoto = /photo/i.test(text(attachment, "FileType")) || /profilepicture/i.test(text(attachment, "Instructions"));
        if (!isPhoto || result.photo) continue;
        const data = kid(attachment, "EmbeddedData");
        result.photo = photoDataUrl(text(data), data?.getAttribute("mimeCode") ?? "");
    }

    return result;
}

function readCandidateLanguages(person: Element | null, profile: Element | null, locale: string): EuropassLanguage[] {
    const languages: EuropassLanguage[] = [];

    for (const primary of kids(person, "PrimaryLanguageCode")) {
        const value = text(primary);
        const isCode = (primary.getAttribute("name") ?? "NORMAL").toUpperCase() !== "FREE_TEXT";
        const name = isCode ? displayName(value, locale, "language") : value;
        if (name) languages.push({ name, native: true, levels: {}, certificates: [] });
    }

    for (const competency of allAt(profile, "PersonQualifications/PersonCompetency")) {
        if (text(competency, "TaxonomyID").toLowerCase() !== "language") continue;
        const idElement = kid(competency, "CompetencyID");
        const value = text(idElement) || text(competency, "CompetencyName");
        const isCode = (idElement?.getAttribute("schemeName") ?? "NORMAL").toUpperCase() !== "FREE_TEXT";
        const name = isCode ? displayName(value, locale, "language") : value;
        if (!name) continue;

        const levels: Partial<Record<CefrSkill, string>> = {};
        for (const dimension of kids(competency, "CompetencyDimension")) {
            const skill = CEF_DIMENSIONS[text(dimension, "CompetencyDimensionTypeCode").toLowerCase()];
            const score = text(dimension, "Score/ScoreText").toUpperCase();
            if (skill && /^[ABC][12]$/.test(score)) levels[skill] = score;
        }
        languages.push({ name, native: false, levels, certificates: [] });
    }

    return languages;
}

function readCandidateSkills(profile: Element | null): string[] {
    const competencies = [
        ...allAt(profile, "Skills/PersonCompetency"),
        ...allAt(profile, "PersonQualifications/PersonCompetency")
            .filter((competency) => text(competency, "TaxonomyID").toLowerCase() !== "language"),
    ];
    return unique(competencies.map((competency) => text(competency, "CompetencyName") || text(competency, "CompetencyID")));
}

function parseCandidate(root: Element): ParsedEuropassCv {
    const profile = kid(root, "CandidateProfile");
    const person = kid(root, "CandidatePerson");
    const locale = (profile?.getAttribute("languageCode") || "en").toLowerCase();
    const cv = emptyCv("europass", locale);

    cv.person = readCandidatePerson(person, profile, locale);
    cv.languages = readCandidateLanguages(person, profile, locale);
    cv.skills = readCandidateSkills(profile);

    for (const employer of allAt(profile, "EmploymentHistory/EmployerHistory")) {
        const organisation = text(employer, "OrganizationName");
        const contact = organisationContact(employer, locale);
        const url = normalizeUrl(text(employer, "Link")) || contact.url;
        const positions = kids(employer, "PositionHistory");

        if (positions.length === 0 && organisation) {
            const { start, end } = period(kid(employer, "EmploymentPeriod"), "CurrentIndicator");
            cv.experience.push({ organisation, position: "", start, end, location: contact.location, description: "", url });
        }

        for (const position of positions) {
            const { start, end } = period(kid(position, "EmploymentPeriod") ?? kid(employer, "EmploymentPeriod"), "CurrentIndicator");
            const positionLocation = joinNonEmpty([text(position, "City"), displayName(text(position, "Country"), locale, "region")], ", ");
            cv.experience.push({
                organisation,
                position: text(position, "PositionTitle"),
                start,
                end,
                location: positionLocation || contact.location,
                description: markdown(position, "Description"),
                url,
            });
        }
    }

    for (const attendance of allAt(profile, "EducationHistory/EducationOrganizationAttendance")) {
        const contact = organisationContact(attendance, locale);
        const { start, end } = period(kid(attendance, "AttendancePeriod"), "Ongoing");
        const degree = kid(attendance, "EducationDegree");
        const thesis = text(degree, "Thesis");
        const entry: EuropassEducation = {
            organisation: text(attendance, "OrganizationName"),
            qualification: text(degree, "DegreeName"),
            field: "",
            start,
            end,
            location: contact.location,
            description: joinNonEmpty([markdown(degree, "OccupationalSkillsCovered"), thesis ? `Thesis: ${thesis}` : ""], "\n\n"),
            score: text(degree, "FinalGrade/ScoreText"),
            url: normalizeUrl(text(attendance, "Link")) || contact.url,
        };
        if (entry.organisation || entry.qualification) cv.education.push(entry);
    }

    for (const certification of allAt(profile, "Certifications/Certification")) {
        const name = text(certification, "CertificationName") || text(certification, "Name");
        if (!name) continue;
        cv.certifications.push({
            name,
            issuer: text(certification, "IssuingAuthority/Name") || text(certification, "IssuingAuthority"),
            date: normalizeEuropassDate(
                text(certification, "FirstIssuedDate/FormattedDateTime")
                || text(certification, "FreeFormEffectivePeriod/StartDate/FormattedDateTime"),
            ),
            description: markdown(certification, "Description"),
            url: normalizeUrl(text(certification, "Link")),
        });
    }

    for (const publication of allAt(profile, "PublicationHistory/Publication")) {
        const title = text(publication, "Title");
        const description = markdown(publication, "FormattedPublicationDescription");
        if (!title && !description) continue;
        cv.publications.push({
            title: title || description.split("\n")[0],
            publisher: text(publication, "Reference"),
            date: normalizeEuropassDate(text(publication, "Year")),
            description: title ? description : "",
            url: normalizeUrl(text(publication, "Link") || text(publication, "DOI/Link")),
        });
    }

    for (const referee of allAt(profile, "EmploymentReferences/Referee")) {
        const communications = kids(referee, "Communication");
        const channel = (code: string) => communications.find((communication) => text(communication, "ChannelCode").toLowerCase().includes(code));
        const name = joinNonEmpty([text(referee, "PersonName/GivenName"), text(referee, "PersonName/FamilyName")], " ")
            || text(referee, "PersonName/FormattedName");
        if (!name) continue;
        cv.references.push({
            name,
            position: text(referee, "Role"),
            email: text(channel("email"), "URI"),
            phone: text(channel("telephone"), "DialNumber") || text(channel("telephone"), "URI"),
            description: markdown(referee, "Comment"),
        });
    }

    cv.projects = readEntries(profile, "Projects", locale);
    cv.courses = readEntries(profile, "CourseCertifications", locale);
    cv.interests = readEntries(profile, "HobbiesAndInterests", locale);

    for (const { container, title } of ACTIVITY_SECTIONS) {
        const entries = readEntries(profile, container, locale);
        addActivitySection(cv, title, entries);
    }

    for (const others of kids(profile, "Others")) {
        const entries = kids(others, "Other").map((other) => readActivity(other, locale)).filter((entry) => entry.title || entry.description);
        addActivitySection(cv, text(others, "Title") || "Other", entries);
    }

    for (const { container, title } of TEXT_SKILL_SECTIONS) {
        const descriptions = kids(profile, container)
            .flatMap((section) => Array.from(section.querySelectorAll("*")))
            .filter((element) => element.localName === "Description")
            .map((element) => markdown(element));
        const body = joinNonEmpty(descriptions, "\n\n");
        if (body) cv.textSections.push({ title, text: body });
    }

    return cv;
}

// ---------------------------------------------------------------------------
// Legacy Europass (SkillsPassport)

const LEGACY_SKILL_SECTIONS: Array<{ element: string; title: string }> = [
    { element: "Communication", title: "Communication skills" },
    { element: "Organisational", title: "Organisational skills" },
    { element: "JobRelated", title: "Job-related skills" },
    { element: "Computer", title: "Digital skills" },
    { element: "Other", title: "Other skills" },
];

function legacyLocation(contactInfo: Element | null, locale: string): string {
    const contact = at(contactInfo, "Address/Contact");
    if (!contact) return "";
    const country = text(contact, "Country/Label") || displayName(text(contact, "Country/Code"), locale, "region");
    return joinNonEmpty([text(contact, "Municipality"), country], ", ");
}

function legacyPeriod(periodElement: Element | null): { start: string; end: string } {
    const current = isTrue(text(periodElement, "Current"));
    return {
        start: legacyDate(at(periodElement, "From")),
        end: current ? "Present" : legacyDate(at(periodElement, "To")),
    };
}

function legacyContacts(contactInfo: Element | null, list: string, item: string): Element[] {
    // v3 wraps repeated contacts in *List elements; some generators do not.
    return [...allAt(contactInfo, `${list}/${item}`), ...kids(contactInfo, item)];
}

function parseSkillsPassport(root: Element): ParsedEuropassCv {
    const locale = (root.getAttribute("locale") || "en").toLowerCase();
    const cv = emptyCv("legacy", locale);
    const learner = kid(root, "LearnerInfo");
    const identification = kid(learner, "Identification");
    const contactInfo = kid(identification, "ContactInfo");
    const person = cv.person;

    person.givenName = text(identification, "PersonName/FirstName");
    person.familyName = text(identification, "PersonName/Surname");
    person.location = legacyLocation(contactInfo, locale);
    person.emails = unique(legacyContacts(contactInfo, "EmailList", "Email").map((email) => text(email, "Contact")));
    person.phones = unique(legacyContacts(contactInfo, "TelephoneList", "Telephone").map((phone) => text(phone, "Contact")));
    person.dateOfBirth = legacyDate(at(identification, "Demographics/Birthdate"), true);

    for (const website of legacyContacts(contactInfo, "WebsiteList", "Website")) {
        const url = normalizeUrl(text(website, "Contact"));
        if (!/^https?:/i.test(url)) continue;
        const useLabel = text(website, "Use/Label") || text(website, "Use/Code");
        person.links.push({ url, kind: linkKind(url), label: useLabel });
    }

    const nationality = at(identification, "Demographics/NationalityList/Nationality") ?? at(identification, "Demographics/Nationality");
    person.nationality = text(nationality, "Code").toUpperCase() || text(nationality, "Label");

    const photo = kid(identification, "Photo");
    person.photo = photoDataUrl(text(photo, "Data"), text(photo, "MimeType"));

    const headline = kid(learner, "Headline");
    const headlineText = text(headline, "Description/Label");
    if (text(headline, "Type/Code").toLowerCase() === "personal_statement") {
        person.summary = europassHtmlToMarkdown(headlineText);
    } else {
        person.headline = headlineText;
    }

    for (const work of [...allAt(learner, "WorkExperienceList/WorkExperience"), ...kids(learner, "WorkExperience")]) {
        const { start, end } = legacyPeriod(kid(work, "Period"));
        const employer = kid(work, "Employer");
        const entry: EuropassExperience = {
            organisation: text(employer, "Name"),
            position: text(work, "Position/Label"),
            start,
            end,
            location: legacyLocation(kid(employer, "ContactInfo"), locale),
            description: markdown(work, "Activities"),
            url: normalizeUrl(text(employer, "ContactInfo/Website/Contact")),
        };
        if (entry.organisation || entry.position) cv.experience.push(entry);
    }

    for (const education of [...allAt(learner, "EducationList/Education"), ...kids(learner, "Education")]) {
        const { start, end } = legacyPeriod(kid(education, "Period"));
        const organisation = kid(education, "Organisation");
        const entry: EuropassEducation = {
            organisation: text(organisation, "Name"),
            qualification: text(education, "Title"),
            field: text(education, "Field/Label"),
            start,
            end,
            location: legacyLocation(kid(organisation, "ContactInfo"), locale),
            description: markdown(education, "Activities"),
            score: "",
            url: normalizeUrl(text(organisation, "ContactInfo/Website/Contact")),
        };
        if (entry.organisation || entry.qualification) cv.education.push(entry);
    }

    const skills = kid(learner, "Skills");
    const linguistic = kid(skills, "Linguistic");
    const languageName = (element: Element) =>
        text(element, "Description/Label") || displayName(text(element, "Description/Code"), locale, "language");

    for (const mother of [...allAt(linguistic, "MotherTongueList/MotherTongue"), ...kids(linguistic, "MotherTongue")]) {
        const name = languageName(mother);
        if (name) cv.languages.push({ name, native: true, levels: {}, certificates: [] });
    }

    for (const foreign of [...allAt(linguistic, "ForeignLanguageList/ForeignLanguage"), ...kids(linguistic, "ForeignLanguage")]) {
        const name = languageName(foreign);
        if (!name) continue;
        const proficiency = kid(foreign, "ProficiencyLevel");
        const levels: Partial<Record<CefrSkill, string>> = {};
        const legacyNames: Record<CefrSkill, string> = {
            listening: "Listening",
            reading: "Reading",
            spokenInteraction: "SpokenInteraction",
            spokenProduction: "SpokenProduction",
            writing: "Writing",
        };
        for (const skill of CEFR_SKILLS) {
            const level = text(proficiency, legacyNames[skill]).toUpperCase();
            if (/^[ABC][12]$/.test(level)) levels[skill] = level;
        }
        const certificates = unique(allAt(foreign, "VerifiedBy/Certificate").map((certificate) => text(certificate, "Title")));
        cv.languages.push({ name, native: false, levels, certificates });
    }

    for (const { element, title } of LEGACY_SKILL_SECTIONS) {
        const body = markdown(kid(skills, element), "Description");
        if (body) cv.textSections.push({ title, text: body });
    }

    person.drivingLicences = unique(allAt(skills, "Driving/Description/Licence").map((licence) => text(licence)));

    for (const achievement of [...allAt(learner, "AchievementList/Achievement"), ...kids(learner, "Achievement")]) {
        const title = text(achievement, "Title/Label") || text(achievement, "Title/Code");
        const body = markdown(achievement, "Description");
        if (body) cv.textSections.push({ title: title || "Achievements", text: body });
    }

    return cv;
}

// ---------------------------------------------------------------------------

export function parseEuropassXml(xml: string): ParsedEuropassCv {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    if (document.getElementsByTagName("parsererror").length > 0) {
        throw new EuropassImportError("corrupt-file");
    }

    const root = document.documentElement;
    if (root.localName === "Candidate") return parseCandidate(root);
    if (root.localName === "SkillsPassport") return parseSkillsPassport(root);
    throw new EuropassImportError("no-europass-data");
}

/** True when the parse found nothing a resume could be built from. */
export function isEmptyEuropassCv(cv: ParsedEuropassCv): boolean {
    const { person } = cv;
    const hasPerson = Boolean(person.givenName || person.familyName || person.summary || person.emails.length);
    const hasContent = [
        cv.experience,
        cv.education,
        cv.languages,
        cv.skills,
        cv.projects,
        cv.courses,
        cv.certifications,
        cv.publications,
        cv.references,
        cv.interests,
        cv.activitySections,
        cv.textSections,
    ].some((list) => list.length > 0);
    return !hasPerson && !hasContent;
}

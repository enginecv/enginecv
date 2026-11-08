import {
    Award,
    BookOpen,
    Briefcase,
    Contact,
    FolderOpen,
    Globe,
    GraduationCap,
    Heart,
    PenLine,
    Puzzle,
    Star,
    UserRound,
    Users,
    type LucideIcon,
} from "lucide-react";

export interface ContentSectionDefinition {
    id: string;
    labelKey: string;
    descriptionKey: string;
    icon: LucideIcon;
    keywords: readonly string[];
    addable: boolean;
    multiple?: boolean;
}

export const CONTENT_SECTIONS = [
    {
        id: "basics",
        labelKey: "editor.personalDetails",
        descriptionKey: "editor.personalDetailsDescription",
        icon: UserRound,
        keywords: ["personal", "profile", "name", "contact", "email", "phone"],
        addable: false,
    },
    {
        id: "education",
        labelKey: "editor.sectionEducation",
        descriptionKey: "editor.sectionEducationDesc",
        icon: GraduationCap,
        keywords: ["education", "school", "university", "degree"],
        addable: true,
    },
    {
        id: "experience",
        labelKey: "editor.sectionExperience",
        descriptionKey: "editor.sectionExperienceDesc",
        icon: Briefcase,
        keywords: ["experience", "work", "employment", "job"],
        addable: true,
    },
    {
        id: "skills",
        labelKey: "editor.sectionSkills",
        descriptionKey: "editor.sectionSkillsDesc",
        icon: Star,
        keywords: ["skills", "technologies", "competencies"],
        addable: true,
    },
    {
        id: "languages",
        labelKey: "editor.sectionLanguages",
        descriptionKey: "editor.sectionLanguagesDesc",
        icon: Globe,
        keywords: ["languages", "fluency", "proficiency"],
        addable: true,
    },
    {
        id: "certificates",
        labelKey: "editor.sectionCertificates",
        descriptionKey: "editor.sectionCertificatesDesc",
        icon: Award,
        keywords: ["certificates", "certifications", "credentials"],
        addable: true,
    },
    {
        id: "interests",
        labelKey: "editor.sectionInterests",
        descriptionKey: "editor.sectionInterestsDesc",
        icon: Heart,
        keywords: ["interests", "hobbies"],
        addable: true,
    },
    {
        id: "projects",
        labelKey: "editor.sectionProjects",
        descriptionKey: "editor.sectionProjectsDesc",
        icon: FolderOpen,
        keywords: ["projects", "portfolio", "repositories"],
        addable: true,
    },
    {
        id: "courses",
        labelKey: "editor.sectionCourses",
        descriptionKey: "editor.sectionCoursesDesc",
        icon: BookOpen,
        keywords: ["courses", "training", "classes"],
        addable: true,
    },
    {
        id: "awards",
        labelKey: "editor.sectionAwards",
        descriptionKey: "editor.sectionAwardsDesc",
        icon: Award,
        keywords: ["awards", "honors", "achievements"],
        addable: true,
    },
    {
        id: "organisations",
        labelKey: "editor.sectionOrganisations",
        descriptionKey: "editor.sectionOrganisationsDesc",
        icon: Users,
        keywords: ["organisations", "organizations", "memberships"],
        addable: true,
    },
    {
        id: "publications",
        labelKey: "editor.sectionPublications",
        descriptionKey: "editor.sectionPublicationsDesc",
        icon: BookOpen,
        keywords: ["publications", "papers", "articles", "books"],
        addable: true,
    },
    {
        id: "references",
        labelKey: "editor.sectionReferences",
        descriptionKey: "editor.sectionReferencesDesc",
        icon: Contact,
        keywords: ["references", "referees", "recommendations"],
        addable: true,
    },
    {
        id: "declaration",
        labelKey: "editor.sectionDeclaration",
        descriptionKey: "editor.sectionDeclarationDesc",
        icon: PenLine,
        keywords: ["declaration", "signature", "statement"],
        addable: true,
    },
    {
        id: "custom",
        labelKey: "editor.sectionCustom",
        descriptionKey: "editor.sectionCustomDesc",
        icon: Puzzle,
        keywords: ["custom", "section", "text", "tags"],
        addable: true,
        multiple: true,
    },
] as const satisfies readonly ContentSectionDefinition[];

export type ContentSectionId = (typeof CONTENT_SECTIONS)[number]["id"];

export const CONTENT_SECTION_BY_ID = Object.fromEntries(
    CONTENT_SECTIONS.map((section) => [section.id, section]),
) as unknown as Record<ContentSectionId, ContentSectionDefinition>;

export function contentSectionBaseId(sectionKey: string): string {
    return sectionKey.split(":")[0];
}

export function hasContentSection(sectionKeys: string[], id: string): boolean {
    return sectionKeys.some((key) => contentSectionBaseId(key) === id);
}

export function getContentSectionDefinition(sectionKey: string): ContentSectionDefinition | undefined {
    return CONTENT_SECTION_BY_ID[contentSectionBaseId(sectionKey) as ContentSectionId];
}

export function isContentSectionAvailable(
    sectionKeys: string[],
    section: ContentSectionDefinition,
): boolean {
    return section.addable && (section.multiple === true || !hasContentSection(sectionKeys, section.id));
}

import type { TemplateProse } from "./types";

export const prose: TemplateProse = {
    slug: "developer",
    overview: [
        "Developer is built on one idea: for people who write software, the work itself is often stronger evidence than a job title, so it should come first. Projects open the page, ahead of experience, and the headings are set in a monospaced typeface that signals the field without turning the page into a costume.",
        "It suits software engineers, but also data, DevOps, security and other technical roles where a repository, a deployed service or a contribution to an open-source project can be shown directly. If you have few public projects, the order is easy to change.",
    ],
    build: [
        "The default section order is projects, experience, skills, education, languages and certificates, so a reader meets what you built before where you were employed. You can reorder sections in the editor, and the template follows. Your name and the section headings are set in JetBrains Mono, with the name at 26 points and the headings at 10.5 points in uppercase, while the body text stays in Inter at 11 points so longer descriptions remain easy to read.",
        "The page is black and white with a full-width rule under each section heading, so the monospaced type does the signalling. Contact details sit in two columns, which leaves room for links such as a GitHub profile and a personal site, and a photo can be placed on the left.",
    ],
    tips: [
        "Describe each project in terms of the problem, your part and the result, and link to the repository or the running service. A link someone can open is more persuasive than a long description.",
        "Tie skills to the projects and roles where you used them instead of listing them in the abstract. A reader can judge a technology you used for a year in a real system far better than a bar chart of self-rated levels.",
        "Keep the stack in context. Name the languages and tools in the entries themselves, and use the skills section as a short index, not as the only place they appear.",
    ],
    alternatives: [
        "If your strongest material is a long employment history rather than projects, Modern or Timeline put experience first without extra editing.",
        "For an application through an online portal, ATS Plain is the simpler structure.",
        "For a role outside tech, the monospaced headings may feel out of place, and Modern or Executive will fit better.",
    ],
};

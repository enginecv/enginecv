/**
 * About page copy (feature 078). English only, like the other long-form
 * content. Every statement here must match /privacy, /your-data and the
 * product's real behavior.
 *
 * Written from the founder interview (2026-11-09). Facts here were confirmed by
 * the owner; do not add biographical claims that were not.
 */

import { SOURCE_REPO_URL } from "@/lib/contact";

export interface AboutSection {
    id: "who" | "why" | "privacy" | "contact";
    heading: string;
    paragraphs: string[];
    links?: { label: string; href: string }[];
}

export const ABOUT_META = {
    title: "About EngineCV | EngineCV",
    description:
        "Who builds EngineCV, why a free resume builder that keeps your data in your browser exists, and how to reach the person behind it.",
    eyebrow: "About",
    heading: "About EngineCV",
    intro:
        "EngineCV is a free resume builder that runs in your browser. This page says who builds it, why it exists, and what that means for your data.",
} as const;

export const ABOUT_SECTIONS: AboutSection[] = [
    {
        id: "who",
        heading: "Who builds EngineCV",
        paragraphs: [
            "EngineCV is built and maintained by Safet Imamovic, a software engineer based in Bosnia and Herzegovina who is also a Masters student and a teaching assistant. It is an independent project: one person decides what gets built, with no company, investors or team behind it. It has been in development since 2026. Most of the guides on the blog are written by the same person, and the same person answers the founder address on the contact page, so a message about the product reaches the one who can change it.",
            "The code is written with the help of AI coding assistants, Claude and Codex. They speed up the typing; the decisions, the review of every change and the responsibility for how your data is handled stay with me. If something is wrong, tell me and I will fix it myself.",
            "EngineCV is open source. The code is published on GitHub under the AGPL-3.0, so you can read how your resume data is handled, report bugs and request features as issues, or send a fix. The blog posts and guide copy are not open licensed; the repository says which parts are which.",
            "Every release is listed on the changelog page, including what changed and when. That history is meant to let you judge how actively the project is looked after, rather than asking you to take it on trust.",
        ],
        links: [
            { label: "EngineCV on GitHub", href: SOURCE_REPO_URL },
            { label: "Safet Imamovic on LinkedIn", href: "https://www.linkedin.com/in/safeti/" },
        ],
    },
    {
        id: "why",
        heading: "Why it exists",
        paragraphs: [
            "I started EngineCV after an hour spent designing a resume in a popular online builder, only to find at the very end that exporting it required a paid subscription. The site called itself a free resume builder, the design was split into steps that kept me invested, and the paywall appeared only once I had put in the work. Along the way, AI features were pushed at me constantly, whether I wanted them or not. A resume is just a document: you can write one in any text editor and turn it into a PDF with free tools, so charging for the export of something I had already built felt wrong.",
            "The tools that did not charge for everything had their own limits. The one I liked most had a clean editor, and some of EngineCV's interface was influenced by it, but it allowed a single resume. In practice people need several, because an employer wants to see that you fit one role, not everything you have ever done. A nurse applying to both a clinic and a care home, or a developer applying to a backend job and a data job, should not have to keep overwriting one document.",
            "Many people also reach for Europass because it is backed by the European Union, then find the templates dated and the editor awkward. EngineCV exists for those people: a builder that is fully local, with no accounts, no paywalls and no data collection, where editing and exporting are free, and where you can keep as many resumes as you like.",
            "Many resume builders let you spend half an hour on a document and then put the download behind a subscription. EngineCV starts from the opposite rule: editing, previewing, importing and exporting stay free, and no feature you need to finish and send a resume is locked behind a paid plan.",
            "The builder works from structured data rather than a pile of text boxes. Your personal details, sections and entries are stored as plain fields, and a template decides how they look. Switching template changes the layout without retyping anything, and the same data exports to PDF, Word, Markdown, plain text, HTML and JSON.",
            "You rarely start from nothing, so the product reads what you already have. You can import a LinkedIn data export, a Europass file or a public GitHub profile, open a CV you saved earlier as JSON, or paste the answer of an AI assistant that followed the published format. The free tools section lets you try some of these steps on their own, and the CV examples show finished resumes for specific jobs that you can copy and edit.",
            "The interface is available in English, Bosnian, German, French and Spanish, because many people apply for jobs in a language other than the one they use day to day.",
        ],
    },
    {
        id: "privacy",
        heading: "How your data is handled",
        paragraphs: [
            "There are no accounts. Your resumes, version history and preferences are stored in your own browser, and EngineCV keeps no server copy. Editing, previewing and exporting happen on your device. The flip side is that clearing your browser data removes the resumes stored there, so keep an exported file or an encrypted JSON backup of anything you care about.",
            "A few features need the network and say so where you use them. The GitHub import contacts GitHub's public API from your browser, and fonts you add by address are loaded from the address you give. The privacy policy lists every case in which your browser contacts a third party, and the Your data page shows what is stored on this device and lets you download it or delete all of it.",
            "The site counts page views with Cloudflare Web Analytics, which is cookieless and aggregate. It cannot read your resume. Advertising, if it appears at all, only loads after you allow it, and it never appears in the editor.",
        ],
    },
    {
        id: "contact",
        heading: "Get in touch",
        paragraphs: [
            "Questions, corrections and ideas are welcome. The contact page lists the support and founder addresses, and bugs or feature requests can be filed in the public repository. If a guide or an example CV contains something you know to be wrong, please say so, because accuracy matters more than the page count.",
        ],
    },
];

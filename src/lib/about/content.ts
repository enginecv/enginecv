/**
 * About page copy (feature 078). English only, like the other long-form
 * content. Every statement here must match /privacy, /your-data and the
 * product's real behavior.
 *
 * TODO(owner): add the founder's background, the moment the project started,
 * and whether "independent project" is accurate. Until then the text below
 * states only facts that are visible in the product and the repository.
 */

export interface AboutSection {
    id: "who" | "why" | "privacy" | "contact";
    heading: string;
    paragraphs: string[];
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
            "EngineCV is built and maintained by Safet Imamovic, who also writes most of the guides on the blog. The same person answers the founder address on the contact page, so a message about the product reaches the one who can change it.",
            "The source code for feedback, bug reports and feature requests lives in a public GitHub repository, and every release is listed on the changelog page, including what changed and when. That history is meant to let you judge how actively the project is looked after, rather than asking you to take it on trust.",
        ],
    },
    {
        id: "why",
        heading: "Why it exists",
        paragraphs: [
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

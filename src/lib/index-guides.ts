/**
 * Short English-only guides shown under the three hub pages (CV examples,
 * templates, tools). The hubs are lists of links, so on their own they carry
 * little text; each guide says how to use the list. English only for now, like
 * the other long-form text: other locales render nothing here.
 * Every statement must match what the pages and tools actually do.
 */

export type IndexGuideId = "examples" | "templates" | "tools";

export interface IndexGuide {
    heading: string;
    paragraphs: string[];
}

export const INDEX_GUIDES: Record<IndexGuideId, IndexGuide> = {
    examples: {
        heading: "How to use these examples",
        paragraphs: [
            "Each example is a complete, fictional CV for one job, with a written walkthrough beside it. Open one that is close to the role you want, read why each part is there, and compare it with your own. The aim is to see the structure and the kind of detail that suits the role, not to copy wording, so treat every sentence as a pattern to replace with your own facts.",
            "When you are ready, the Edit this example button on each page puts a copy into your browser as a new CV and opens it in the editor. Every press makes a fresh copy and leaves your existing CVs alone. Replace the fictional name, employers and contact details first, then cut anything that does not apply to you, since an example usually shows more than any one person needs.",
            "The examples currently cover eight roles: software developer, frontend developer, backend developer, DevOps engineer, data analyst, QA tester, IT support and nurse. If your job is not listed, pick the closest one for structure and adapt the content. More roles will be added over time, and each one is written from what that role needs, not generated from a template.",
        ],
    },
    templates: {
        heading: "How to choose a template",
        paragraphs: [
            "Start with where the CV is going. If it will be uploaded to an employer's online form, a single-column layout without icons, such as ATS Plain, is the lowest-risk choice. If a person will read it directly, Modern, Sidebar or Timeline look more finished while staying clean. For a formal or senior role, Executive uses serif type and more space. For technical roles, Developer puts projects ahead of experience.",
            "Then think about convention. A photo in the header is normal in parts of continental Europe, including Germany, Austria, Switzerland and the Balkans, and less usual in some other countries. Photo Header and Lebenslauf are built around a photo, and the filters above show which templates use one. Lebenslauf also follows the German tabular style, with a date column on the left of every entry.",
            "The previews use sample content, so they show a full page rather than your own. All eight templates are free, and you do not need an account to try one. Pick the closest match and adjust fonts and colours in the editor afterwards if you want a different feel.",
        ],
    },
    tools: {
        heading: "Which tool do you need?",
        paragraphs: [
            "Three of the tools bring information you already have into a CV, so you do not retype it. The Europass tool reads a CV exported from Europass, the LinkedIn tool reads the data archive you can request from LinkedIn, and the GitHub tool builds project entries from your public repositories. Each page explains what the file or profile must contain, what ends up in your CV, and what to check afterwards.",
            "The fourth tool, the CEFR level tool, helps you describe how well you speak a language. It walks you through plain statements for listening, reading, speaking and writing, so you can choose the ones that are true for you instead of guessing a level, and it gives you a result you can put on a CV.",
            "Each tool page says exactly what happens to your data, including the one case where a network request is needed. If you are unsure where to start, begin with the source you keep most up to date: LinkedIn for a long work history, GitHub for a developer with public projects, or Europass if you already keep a CV there.",
        ],
    },
};

export function getIndexGuide(id: IndexGuideId): IndexGuide {
    return INDEX_GUIDES[id];
}

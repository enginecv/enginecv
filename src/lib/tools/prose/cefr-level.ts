import type { ToolProse } from "./types";

export const prose: ToolProse = {
    slug: "cefr-level",
    overview: [
        "The Common European Framework of Reference, known as CEFR, describes language ability on six levels from A1 to C2, across five skills: listening, reading, spoken interaction, spoken production and writing. This tool walks you through them with plain statements, so you can pick the ones that are true for you on an ordinary day instead of rounding up.",
        "It is for people who need to put a language level on a CV and are unsure what to write: someone who reads German well but speaks it hesitantly, someone who studied a language years ago, or someone who has never been tested. The result is a level for each skill and an overall level, ready to add to a CV in the grid that European employers know from Europass.",
    ],
    formatsHeading: "What goes in and what comes out",
    formats: [
        {
            name: "What you provide",
            detail: "A language name of up to 60 characters and, for each of the five skills, the statement that fits you best. You can skip a skill you would rather not rate, but you need at least one rated skill to see a result. You rate one language at a time.",
        },
        {
            name: "What you get",
            detail: "A CEFR level for each skill you rated, plus an overall level.",
        },
        {
            name: "Where it can go",
            detail: "Into an existing CV, or into a new CV that holds only that language in the grid layout. If the CV already lists the language, its levels are updated. A mother tongue is never changed by a self-assessment, and changes to an existing CV are recorded in its history so you can undo them there.",
        },
    ],
    privacy: [
        "Your answers stay in your browser. Nothing is sent anywhere while you work, and nothing is saved until you choose to add the result to a CV.",
        "When you do add it, it is stored in your browser's local database on this device, like any other CV you make in EngineCV.",
    ],
    limits: [
        "This is a self-assessment and not a certificate, and the CV marks it that way. If an employer or an authority needs proof, you need an exam such as Goethe, telc, DELF or a Cambridge certificate.",
        "The statements are a guide, not a test. Two people can read the same statement differently, so choose the highest one that is true on a normal day and not on your best day.",
        "The overall level is the middle value of the skills you rated, rounded down. Five skills rated B1, B1, B2, B2 and C1 give an overall B2. Four skills rated A2, B1, B1 and B2 give an overall B1, because with an even number the lower middle value is used.",
        "The wording of the statements is general and works for any language. If a language has its own exam scale, name the exam and your score on the CV as well.",
        "A level is a snapshot. Run the assessment again after a course, an exam or a stay abroad, and update the CV so that it stays honest as your language improves.",
    ],
};

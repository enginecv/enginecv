import type { ToolProse } from "./types";

export const prose: ToolProse = {
    slug: "europass-to-cv",
    overview: [
        "Europass is the CV format and portal offered by the European Union, and many people have a CV there from a job search, a study application or an official procedure. This tool is for the moment you want that same content with a different look, or in a form you can edit in a word processor, without typing it all in again.",
        "EngineCV reads the data Europass stores inside the files it gives you, not the picture of the page. That is why it can recover your experience, education, languages and skills as separate fields instead of one block of text. After the import you land in the normal editor, so everything you can do with a CV started from scratch works here too: change the template, reorder sections, rewrite the wording and export.",
        "What comes across, where your file contains it: your name, headline, summary and photo, contact details, date of birth, nationality and driving licence, work experience, education, languages with the five-skill grid, skills, projects, courses, certificates, publications, references and interests, plus any extra sections you added in Europass.",
        "Some employers like the familiar Europass look, and others read it as a form. If you are unsure, keep the Europass version for official uses, such as applications that ask for it, and send a tailored version to employers who do not.",
    ],
    formatsHeading: "Files it reads",    formats: [
        {
            name: "Europass PDF",
            detail: "The PDF you download from the Europass CV editor. Europass embeds your CV data in that file as an attachment, and EngineCV reads the attachment. Files up to 20 MB are accepted.",
        },
        {
            name: "Europass XML",
            detail: "An XML file exported from Europass, including files from the older Europass editor. Plain XML is read directly.",
        },
        {
            name: "Files that will not work",
            detail: "A PDF that has been printed again, re-saved in a PDF editor or converted from Word has usually lost the embedded data. Scans and screenshots never had it. Download the CV from Europass again and use that file unchanged.",
        },
    ],
    privacy: [
        "The file is opened and read by your browser, on your own device. EngineCV has no server that receives it, and the page does not upload it anywhere.",
        "Only the CV you confirm is saved, in your browser's local database on this device. Nothing is sent to EngineCV or to Europass at any point.",
    ],
    limits: [
        "Experience entries arrive as the description text from Europass, not as separate bullet points. Split or rewrite them in the editor if you want bullets.",
        "Skills arrive as a plain list without levels.",
        "Languages come with the CEFR grid that Europass uses, marked as self-assessed. A mother tongue is imported as native, without a level.",
        "Personal details are imported only if your file has them, and nationality is kept only when it is stored as a two-letter country code. Check them in the editor before you share the CV, because you may not want your date of birth on every version.",
        "Unusual Europass sections may not map cleanly. Always check the preview before you open the CV in the editor.",
    ],
};

import type { ToolProse } from "./types";

export const prose: ToolProse = {
    slug: "json-resume-editor",
    overview: [
        "JSON Resume is an open format for resumes. A resume is stored as one JSON file, usually named resume.json, with sections called basics, work, education, skills and a few more. Developers like it because the file is plain text that can live in a repository, be diffed, and be turned into a web page or a PDF by whichever theme or tool they prefer. The catch is that editing raw JSON is not pleasant, and the themes that render it vary a lot in quality.",
        "This tool is for the moment you have a resume.json and want to work on it in a visual editor. EngineCV converts the file into an editable CV, shows you what it found, and tells you plainly which parts could not be carried over. After that you can edit every field, pick one of the templates, reorder sections and export to PDF or Word.",
        "It works in the other direction too. When you are done, choose JSON Resume in the export window and download your CV in that format, so the data stays usable in the other tools you rely on. Because the format cannot hold everything EngineCV stores, a short list shows what was left out or changed before you download.",
        "The conversion keeps as much as the two formats have in common: your name, title, summary and contact details, the address in separate parts, profiles, work, volunteering, education, awards, certificates, publications, skills, languages, interests, references and projects. It does not guess. A value that is missing in your file stays missing, and one that cannot be read is listed instead of being silently dropped.",
    ],
    formatsHeading: "What goes in and what comes out",
    formats: [
        {
            name: "A resume.json file",
            detail: "A JSON file that follows the JSON Resume schema, version 1.0.0. Choose it with the button or drop it on the box. Files up to 2 MB are read. A resume.json is normally a few kilobytes, so the limit only matters if you embedded large images.",
        },
        {
            name: "Pasted JSON text",
            detail: "If you have the contents of the file on your clipboard, paste them into the text box instead. This is handy when the resume lives in a repository or an editor and you do not want to save a copy first.",
        },
        {
            name: "What you get",
            detail: "A CV in the editor with your content in the matching sections, ready to restyle. You can export it as PDF or Word, and as JSON Resume again, with a list of anything the format could not hold.",
        },
    ],
    privacy: [
        "Reading happens in your browser tab, on your own device. EngineCV runs no service that could receive the file, so the page has nothing to send.",
        "Nothing is fetched from the web during the import. If your file contains the address of a photo, the address is noted in the list of changes, and the picture is not downloaded.",
        "Until you confirm, the converted result exists only in memory and disappears when you close the tab. Once you confirm, the CV is stored in this browser's local database.",
    ],
    limits: [
        "The file has to follow the JSON Resume format. A file that is valid JSON but has a different shape is rejected with an explanation, not converted into an empty CV.",
        "Keys that the format does not define are ignored, and a theme setting is left out, because themes belong to other tools. Both are listed.",
        "Some details have no matching place in EngineCV. A company description on a work entry, the roles on a project and the web address of a photo are left out on import.",
        "Dates may lose their day. Where a date has more detail than EngineCV keeps, the list of changes says so.",
        "On export, some EngineCV content cannot be written: custom sections, personal details such as date of birth, hidden entries, and the detailed language levels. Skill groups are flattened into one list. Each of these is listed before you download.",
        "A photo is written into the exported file only if you switch on Include photo. Other tools may not display it.",
    ],
};

import type { TemplateProse } from "./types";

export const prose: TemplateProse = {
    slug: "ats-plain",
    overview: [
        "ATS Plain strips the layout down to the parts a parser has the least trouble with: one column, ordinary text, standard section headings and no decoration. It is meant for applications that start in an online portal, where your file may be read by software before a person sees it.",
        "No template can promise how a particular employer's software will behave, and systems differ widely. What this one does is remove the choices that most often cause problems: columns that can be read in the wrong order, icons that become stray characters, and layout tricks that do not survive copy and paste. The result is a plain, readable page that works for people too.",
    ],
    build: [
        "Everything runs in a single column, so the reading order on the page is the same as the order in the file. Section icons are switched off, because an icon is decoration that text extraction cannot read. Entries use a single-column layout rather than a separate date column, so each job reads as a title, an employer and a date line followed by its bullets.",
        "The type is Inter at 10.5 points, slightly larger than most of the other templates, and your name is set at 26 points, smaller than elsewhere so the page does not open with a large banner. The accent colour is applied only to the lines under the section headings, and those are near black, so the page is effectively monochrome. Photo support exists, but a plain CV for a portal rarely needs one.",
    ],
    tips: [
        "Use the standard section names the template provides, such as Experience, Education and Skills. Renaming them to something creative gains little and can make automatic reading harder.",
        "Write job titles and tools the way the job advert writes them. If the advert says a tool by name and you have used it, say so in plain words rather than in a graphic or a rating bar.",
        "Export the PDF and select the text on the page. If you can select and copy it in a sensible order, that is a quick sanity check that a reader program can do the same.",
    ],
    alternatives: [
        "If you are sending the CV directly to a person, such as a hiring manager or a contact, Modern or Sidebar will look more finished while staying clean.",
        "For a design-led role where the CV itself is part of the application, a plain layout may undersell you; Timeline or Executive give more character.",
        "If you need a photo as part of a regional convention, Photo Header or Lebenslauf are built around one.",
    ],
};

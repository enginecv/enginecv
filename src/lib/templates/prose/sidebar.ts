import type { TemplateProse } from "./types";

export const prose: TemplateProse = {
    slug: "sidebar",
    overview: [
        "Sidebar splits the page into a narrow side column and a wide main column. The short, list-like parts of a CV go to the side, and the parts that need sentences get the width. It suits people whose skills, languages and certificates are a real part of their case and who would otherwise watch those lists push their experience onto a second page.",
        "It is a structured, calm layout with a burgundy accent. The side column makes the page feel organised at a glance, and because the lists live there, the main column stays focused on what you did and where.",
    ],
    build: [
        "The page has two columns, with the left column set to roughly a third of the width. Skills, languages and certificates are placed in the left column. Experience, education and projects go in the right column, and the order within it follows the editor, with experience first. Your name and contact details sit in a header across the top, with an optional square photo with rounded corners on the right of it.",
        "A burgundy accent colours your name and job title, the underline below the header block and the small level indicators. Each section heading sits on a pale rose band so it is easy to find, and the type is Inter at 10.5 points with your name at 32. Because the columns are fixed by section type, you do not have to arrange anything yourself: add a skill and it appears in the side column.",
    ],
    tips: [
        "Keep skills to the ones you could talk about in an interview. A long side column is easy to fill and easy to skim past, so a shorter, honest list reads better than an exhaustive one.",
        "If you rate languages, use the CEFR grid so the levels mean something specific to a reader, and leave a language unrated rather than guessing.",
        "Check the print preview before sending. Two columns make the length of each column visible, and one column running much longer than the other looks unbalanced.",
    ],
    alternatives: [
        "If you will send the CV through an online form that reads text, a single-column template such as ATS Plain avoids any doubt about reading order.",
        "If you have very little to put in skills, languages or certificates, the side column will look empty, and Modern will use the space better.",
        "If your career story is the main point, Timeline puts the sequence of roles in front.",
    ],
};

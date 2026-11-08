import type { ToolProse } from "./types";

export const prose: ToolProse = {
    slug: "linkedin-to-cv",
    overview: [
        "LinkedIn does not let other sites read your profile directly, but it does let you download your own data. This tool uses that download. You request the export from LinkedIn, wait for the email, and drop the ZIP file here. EngineCV never connects to LinkedIn and never asks for your password.",
        "It is a good starting point when your profile is the most complete record of your career you have. Treat the result as a first draft. A profile is written to be found and to attract contacts, while a CV is written for one job, so you will usually shorten, reorder and rewrite what comes across.",
        "What comes across: your name, headline, summary, location and first website, your positions with dates and descriptions, education with degree and notes, skills, certifications with the issuer and licence number, languages and projects.",
        "After the import, plan on four edits. Rewrite the summary for the job you are applying for. Trim older positions to a line or two. Add your contact details, which are not part of the import. And restate your language levels on the CEFR scale. Fifteen minutes on those four usually turns a profile dump into a usable CV.",
    ],
    formatsHeading: "What you can drop in",
    formats: [
        {
            name: "LinkedIn data export (ZIP)",
            detail: "The ZIP file LinkedIn emails you. Drop it as it is, without unzipping. EngineCV reads only the files it needs: Profile, Positions, Education, Skills, Certifications, Languages and Projects. Everything else in a full archive, such as messages and media, is skipped and never read. The limit is 50 MB in total.",
        },
        {
            name: "Individual CSV files",
            detail: "If you already unzipped the archive, you can drop the CSV files with those names instead. When you drop a ZIP, it takes priority and any extra files are ignored.",
        },
    ],
    privacy: [
        "Your export is opened and read in your browser. It is not uploaded, and EngineCV has no account system that could link it to you.",
        "A LinkedIn export can contain far more than a CV needs, especially the full archive. EngineCV skips every file it does not use. Even so, delete the export from your downloads folder when you are finished, since it still sits on your device.",
    ],
    limits: [
        "Email address and phone number are not imported. Add them in the editor.",
        "The profile photo is not imported.",
        "Only the first website on your profile is used.",
        "Positions arrive with their description text, not as separate bullet points, and the wording often needs tightening for a CV.",
        "Language levels arrive in LinkedIn's own wording, not as CEFR levels, and are marked as self-assessed. Use the editor, or the CEFR tool on this site, to restate them on the scale employers expect.",
        "Recommendations, endorsements and posts are not part of the import.",
    ],
};

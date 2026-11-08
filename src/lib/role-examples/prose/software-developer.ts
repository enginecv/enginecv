import type { RoleExampleLocale, RoleProse } from "../registry";

export const prose: Partial<Record<RoleExampleLocale, RoleProse>> = {
    en: {
        intro:
            "This example shows a full-stack developer with five years of experience applying for a product team in the DACH region. "
            + "It is one page of plain, parseable text: a short summary, two recent roles with measurable results, a focused skills list "
            + "and honest language levels. Copy the structure, then replace every fact with your own. Recruiters and applicant tracking "
            + "systems often read the first half of the page first, so the strongest evidence belongs there.",
        tips: [
            "Lead each job with a result, not a duty. \"Cut page load from 4.1 s to 1.3 s\" tells a hiring manager more than \"responsible for the frontend\", and a number is easy to check in an interview.",
            "Tie your skills to the places you used them. Naming the technologies inside each role, or the project where you learned them, is a stronger signal than a block of tools on its own. Recruiters differ here and some only scan a skills list, so keep a short one as well. EngineCV lets you attach skills to a role and keep a separate skills section, so you can do both.",
            "Keep the skills list short and honest. Ten tools you have shipped with beat thirty you have opened once. Be careful with self-rated levels: they are subjective, and \"expert\" invites questions that test it, so claim a level only if you could defend it.",
            "Add a link to your GitHub profile or one project you can explain in detail, but only if the repository is readable. A tidy README with a screenshot and a clear setup does more than a long list of unfinished experiments.",
            "State your German and English level with a recognised scale (A1 to C2) and name the certificate if you have one. For many teams in the DACH region, a clear B1 or B2 in German is a plus even when the working language is English.",
        ],
        skills: [
            "TypeScript",
            "React",
            "Node.js",
            "PostgreSQL",
            "REST and GraphQL APIs",
            "Docker",
            "Git and code review",
            "Automated testing (Playwright, Vitest)",
            "CI/CD pipelines",
            "Agile teamwork (Scrum, Kanban)",
        ],
        sections: [
            {
                heading: "Why this CV works",
                paragraphs: [
                    "The page answers three questions in the order a reader asks them: what does this person build, have they done it recently, and can they work with a team. "
                    + "The headline names the stack, so the match is visible before the first paragraph. The two roles that follow are the most recent and the most relevant, "
                    + "and each carries a result that can be checked rather than a duty that cannot.",
                    "Look at how the bullets are built. \"Rebuilt the shipment tracking app in React and TypeScript; page load fell from 4.1 s to 1.3 s\" gives the task, the technology "
                    + "and the outcome in one line. \"Designed a Node.js API for 40 partner integrations with contract tests in CI\" shows scale and a working practice, which tells an "
                    + "engineering manager how this person works as well as what they built. Each line is a piece of work the candidate can talk through for ten minutes.",
                    "The language block is small but deliberate. English C1 and German B1 are stated on a recognised scale, and the German entry shows reading ahead of writing. "
                    + "That honesty helps, because an interview that exposes a gap the CV hid costs far more trust than the gap itself.",
                ],
            },
            {
                heading: "Keywords to use, and how",
                paragraphs: [
                    "How a CV gets screened varies: some recruiters and tracking systems search for technology names, others read the experience entries first, and many do both. "
                    + "So write the names the way job advertisements do and keep them consistent. TypeScript, React, Node.js, PostgreSQL and Docker appear here spelled in full, in the "
                    + "headline and inside each role. Avoid private shorthand, and avoid collapsing a stack into a phrase such as \"modern web technologies\", which matches nothing a recruiter would type.",
                    "Add the practice words a posting at your level asks for, but only the ones you can defend: code review, CI, automated testing, REST APIs, Scrum. They work best "
                    + "inside a sentence about what you did, as with \"contract tests in CI\". Read three advertisements for the job you want and check that each repeated term you "
                    + "genuinely have is on the page in the advertisement's wording.",
                ],
            },
            {
                heading: "Mistakes to avoid on a developer CV",
                paragraphs: [
                    "The most common mistake is the technology dump: forty tools in one block, with no sign of where you used any of them. A reader cannot tell a daily tool from a "
                    + "tutorial, and many will discount the whole block. Tie skills to a project or a role instead, so each one comes with evidence. The second mistake is the duty list. "
                    + "\"Responsible for the backend\" says where you sat, not what changed because you were there.",
                    "Developers also tend to hide behind \"we\", or to claim a whole system when they built one part of it. Use \"I\" for what you did and name the team for what "
                    + "it did together. Two more mistakes: a GitHub link that leads to empty or abandoned repositories, and a three-page CV that keeps every project ever built. "
                    + "A project that does not help this application should go.",
                    "Finally, remember that anyone may ask about anything on the page, and a self-rated level is the easiest claim to test. Call yourself an expert in C++ and someone may ask "
                    + "a detail only deep knowledge answers; the label then becomes the interview. Levels are subjective, so claim one only if you could defend it under questioning, "
                    + "or leave levels out and let your projects show the depth. Before you send the CV, read it as the interviewer would and fix the line you hope nobody asks about.",
                ],
            },
        ],
    },
    de: {
        intro:
            "Dieses Muster zeigt einen Full-Stack-Entwickler mit fünf Jahren Berufserfahrung, der sich bei einem Produktteam im DACH-Raum bewirbt. "
            + "Es besteht aus einer Seite mit klarem, maschinenlesbarem Text: eine kurze Zusammenfassung, zwei aktuelle Stationen mit messbaren "
            + "Ergebnissen, eine fokussierte Skill-Liste und ehrlich angegebene Sprachkenntnisse. Übernehmen Sie den Aufbau und ersetzen Sie jede "
            + "Angabe durch Ihre eigene. Recruiter und Bewerbermanagementsysteme lesen zuerst die obere Seitenhälfte, deshalb gehören dort Ihre stärksten Belege hin.",
        tips: [
            "Beginnen Sie jede Station mit einem Ergebnis statt mit einer Aufgabe. „Ladezeit von 4,1 s auf 1,3 s gesenkt“ sagt einer Personalerin mehr als „zuständig für das Frontend“, und eine Zahl lässt sich im Gespräch leicht überprüfen.",
            "Nennen Sie die eingesetzten Technologien bei jeder Station und zusätzlich im Skills-Abschnitt. Recruiter suchen nach einem Stack, und eine Fähigkeit direkt neben dem Projekt, in dem Sie sie genutzt haben, wirkt belegt statt behauptet.",
            "Halten Sie die Skill-Liste kurz und sortieren Sie nach Ihrem Kenntnisstand. Zehn Werkzeuge, mit denen Sie ausgeliefert haben, überzeugen mehr als dreißig, die Sie nur kurz geöffnet haben; deutsche Arbeitgeber fragen oft zu jedem Punkt nach.",
            "Verlinken Sie Ihr GitHub-Profil oder ein Projekt, das Sie im Detail erklären können, aber nur wenn das Repository lesbar ist. Eine aufgeräumte README mit Screenshot und klarer Anleitung wirkt stärker als viele unfertige Experimente.",
            "Geben Sie Ihr Deutsch- und Englischniveau nach dem Referenzrahmen (A1 bis C2) an und nennen Sie das Zertifikat, falls vorhanden. Für viele Teams im DACH-Raum ist ein klares B1 oder B2 in Deutsch ein Pluspunkt, auch wenn im Team Englisch gesprochen wird.",
        ],
        skills: [
            "TypeScript",
            "React",
            "Node.js",
            "PostgreSQL",
            "REST- und GraphQL-Schnittstellen",
            "Docker",
            "Git und Code-Review",
            "Automatisierte Tests (Playwright, Vitest)",
            "CI/CD-Pipelines",
            "Agile Zusammenarbeit (Scrum, Kanban)",
        ],
    },
};

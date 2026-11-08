import type { RoleExampleLocale, RoleProse } from "../registry";

export const prose: Partial<Record<RoleExampleLocale, RoleProse>> = {
    en: {
        intro:
            "This example shows a QA engineer with five years of experience in manual and automated testing who is applying for a QA role in the DACH region. "
            + "The CV is one page: a short profile, two roles that show how the candidate grew from manual testing to automation, a focused skills list and honest language levels. "
            + "Use the structure and replace every detail with your own. QA hiring managers often look for people who prevent problems, not only report them.",
        tips: [
            "Show the move from finding bugs to preventing them. Building an automated suite that runs on every pull request, or writing a release checklist the team follows, shows that you improve the process and not only the product.",
            "Give your test numbers some context. \"240 end-to-end tests in 11 minutes\" tells a reader about scale and speed, and lowering flaky tests from 18% to under 2% shows the quality of your engineering, which many candidates cannot claim.",
            "Describe a defect you caught and why it mattered. A single sentence about a payment rounding error found before release is more memorable than a list of tested features, and it proves attention to detail.",
            "List the full toolchain: test management, issue tracking, API tools and CI. German employers often want testers who can read logs and queries, so mention SQL or API testing if you do them.",
            "Be clear about your level of automation. If you write code, name the language and framework; if you mostly test manually, say so and mention what you are learning, because an honest profile fits the right team better.",
        ],
        skills: [
            "Test automation (Playwright)",
            "API testing (Postman)",
            "Test design and planning",
            "Jira and TestRail",
            "SQL for test data",
            "CI integration (GitHub Actions)",
            "Exploratory testing",
            "Bug reporting",
            "Accessibility testing basics",
            "Agile teamwork",
        ],
        sections: [
            {
                heading: "From finding defects to preventing them",
                paragraphs: [
                    "The two roles show a path that QA hiring managers tend to recognise: manual testing of banking portals first, then ownership of an automated suite. The earlier role earns its place with a defect story and a count of test cases, the later one with scale, speed and stability. Together they say the candidate understands what a test is for, not only how to write one.",
                    "Flakiness is the quiet star of the Appforge role. Reducing flaky tests from 18% to under 2% tells a reader the suite is trusted, because a suite people ignore is worth little however large it is. If you have fixed unreliable tests, say what caused the problem and how you found it. That story is more convincing than a test count.",
                ],
            },
            {
                heading: "How to write about manual testing",
                paragraphs: [
                    "Manual testing is real work, and the example treats it that way: about 600 test cases written in TestRail and one payment defect caught before release. If most of your experience is manual, do not apologise for it. Describe the products, the risks you tested for and what the team did differently because of your findings, then say plainly what you are learning about automation, naming the language or framework.",
                    "The rounding defect works because it is small and specific. Money, dates and permissions are areas where a single defect is easy to explain and obviously costly. Pick one defect from your own work that you can describe in two sentences: what was wrong, how you found it and what it would have cost.",
                ],
            },
            {
                heading: "Mistakes on a tester's CV",
                paragraphs: [
                    "The usual mistake is a row of tools, with Selenium, Cypress, Playwright, JMeter and Postman side by side and nothing to show you used more than one. Match each tool to what you tested with it. Another is describing activity without outcome. Executed test cases tells a reader nothing about quality, so say what the testing found, prevented or sped up.",
                    "Be exact about the word automation. Recording a script in a tool and designing a maintainable framework are very different skills, and a hiring team will probe which you mean. Say whether you wrote the tests, maintained a suite someone else built, or ran it. If you test accessibility or performance, say how, and keep the claim to what you could demonstrate in an interview.",
                ],
            },
        ],
    },
    de: {
        intro:
            "Dieses Muster zeigt einen QA-Engineer mit fünf Jahren Erfahrung in manuellen und automatisierten Tests, der sich auf eine QA-Stelle im DACH-Raum bewirbt. "
            + "Der Lebenslauf umfasst eine Seite: kurzes Profil, zwei Stationen, die den Weg vom manuellen Testen zur Automatisierung zeigen, eine fokussierte Skill-Liste und ehrliche Sprachniveaus. "
            + "Übernehmen Sie den Aufbau und ersetzen Sie jede Angabe durch Ihre eigene. Wer QA-Stellen besetzt, sucht Menschen, die Probleme verhindern und nicht nur melden.",
        tips: [
            "Zeigen Sie den Schritt vom Finden zum Verhindern von Fehlern. Eine automatisierte Suite, die bei jedem Pull Request läuft, oder eine Release-Checkliste, der das Team folgt, zeigt, dass Sie den Prozess verbessern und nicht nur das Produkt.",
            "Geben Sie Ihren Testzahlen Kontext. „240 End-to-End-Tests in 11 Minuten“ sagt dem Leser etwas über Umfang und Tempo, und instabile Tests von 18 % auf unter 2 % zu senken belegt die Qualität Ihrer Arbeit, was viele Bewerber nicht von sich sagen können.",
            "Beschreiben Sie einen gefundenen Fehler und warum er wichtig war. Ein Satz über einen vor dem Release entdeckten Rundungsfehler bei Zahlungen bleibt eher im Gedächtnis als eine Liste getesteter Funktionen und belegt Ihre Sorgfalt.",
            "Nennen Sie die gesamte Werkzeugkette: Testverwaltung, Ticketsystem, API-Werkzeuge und CI. Deutsche Arbeitgeber wünschen sich oft Tester, die Logs und Abfragen lesen können; erwähnen Sie also SQL oder API-Tests, wenn Sie sie nutzen.",
            "Seien Sie klar zu Ihrem Automatisierungsgrad. Wenn Sie Code schreiben, nennen Sie Sprache und Framework; wenn Sie überwiegend manuell testen, sagen Sie das und nennen Sie, was Sie gerade lernen, denn ein ehrliches Profil passt besser zum richtigen Team.",
        ],
        skills: [
            "Testautomatisierung (Playwright)",
            "API-Tests (Postman)",
            "Testentwurf und Testplanung",
            "Jira und TestRail",
            "SQL für Testdaten",
            "CI-Anbindung (GitHub Actions)",
            "Exploratives Testen",
            "Fehlerberichte schreiben",
            "Grundlagen Barrierefreiheitstests",
            "Agile Zusammenarbeit",
        ],
    },
};

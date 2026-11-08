import type { ExampleContent } from "./types";

/** Role example (#64). The person and all contact details are fictional. */
export const content: ExampleContent = {
    en: () => ({
        description: "Example CV: QA tester.",
        basics: {
            name: "Dino Hasanović",
            headline: "QA Engineer — Test Automation, Playwright, API Testing",
            email: "dino.hasanovic@example.com",
            phone: "+387 61 000 007",
            location: "Sarajevo, Bosnia and Herzegovina (open to relocation)",
            summary:
                "QA engineer with five years of experience in manual and automated testing for web and mobile products. "
                + "I find defects early, write tests that stay stable and explain problems so developers can reproduce them in "
                + "minutes. Looking for a QA role in the DACH region.",
        },
        experience: [
            {
                id: "exp-1",
                company: "Appforge Studio",
                position: "QA Engineer",
                start: "2022-10",
                end: "Present",
                location: "Sarajevo",
                highlights: [
                    "Built a Playwright suite of 240 end-to-end tests that runs in 11 minutes on every pull request.",
                    "Reduced flaky tests from 18% to under 2% by fixing waits and test data.",
                    "Wrote the release checklist the team now follows for each mobile build.",
                ],
                skills: ["Playwright", "TypeScript", "Postman", "GitHub Actions"],
            },
            {
                id: "exp-2",
                company: "Teststream Services",
                position: "Manual Tester",
                start: "2019-11",
                end: "2022-09",
                location: "Sarajevo",
                highlights: [
                    "Tested banking web portals and wrote about 600 test cases in TestRail.",
                    "Found and documented a payment rounding defect before release.",
                ],
                skills: ["TestRail", "Jira", "SQL"],
            },
        ],
        education: [
            {
                id: "edu-1",
                institution: "International Burch University, Sarajevo",
                area: "Information Technologies",
                studyType: "BSc",
                start: "2015-10",
                end: "2019-07",
                location: "Sarajevo",
            },
        ],
        skillGroups: [
            {
                id: "group-main",
                name: "",
                skills: [
                    { id: "skill-1", name: "Test automation (Playwright)", level: "expert" },
                    { id: "skill-2", name: "API testing (Postman)", level: "proficient" },
                    { id: "skill-3", name: "Test design and planning", level: "expert" },
                    { id: "skill-4", name: "Jira and TestRail", level: "expert" },
                    { id: "skill-5", name: "SQL", level: "competent" },
                ],
            },
        ],
        languages: [
            { id: "lang-1", language: "Bosnian", fluency: "Native" },
            {
                id: "lang-2",
                language: "English",
                fluency: "C1",
                cefrDetailed: true,
                cefr: { listening: "C1", reading: "C1", spokenInteraction: "C1", spokenProduction: "B2", writing: "C1" },
            },
            {
                id: "lang-3",
                language: "German",
                fluency: "A2",
                cefrDetailed: true,
                cefr: { listening: "A2", reading: "A2", spokenInteraction: "A2", spokenProduction: "A2", writing: "A1" },
            },
        ],
    }),
    de: () => ({
        description: "Beispiel-Lebenslauf: Softwaretester.",
        basics: {
            name: "Dino Hasanović",
            headline: "QA-Engineer — Testautomatisierung, Playwright, API-Tests",
            email: "dino.hasanovic@example.com",
            phone: "+387 61 000 007",
            location: "Sarajevo, Bosnien und Herzegowina (Umzug möglich)",
            summary:
                "QA-Engineer mit fünf Jahren Erfahrung in manuellen und automatisierten Tests für Web- und Mobile-Produkte. "
                + "Ich finde Fehler früh, schreibe stabile Tests und beschreibe Probleme so, dass Entwickler sie in wenigen "
                + "Minuten nachstellen können. Ich suche eine QA-Stelle im DACH-Raum.",
        },
        experience: [
            {
                id: "exp-1",
                company: "Appforge Studio",
                position: "QA-Engineer",
                start: "2022-10",
                end: "Present",
                location: "Sarajevo",
                highlights: [
                    "Aufbau einer Playwright-Suite mit 240 End-to-End-Tests, die bei jedem Pull Request in 11 Minuten läuft.",
                    "Instabile Tests von 18 % auf unter 2 % gesenkt, durch bessere Wartebedingungen und Testdaten.",
                    "Erstellung der Release-Checkliste, die das Team heute für jeden Mobile-Build nutzt.",
                ],
                skills: ["Playwright", "TypeScript", "Postman", "GitHub Actions"],
            },
            {
                id: "exp-2",
                company: "Teststream Services",
                position: "Softwaretester",
                start: "2019-11",
                end: "2022-09",
                location: "Sarajevo",
                highlights: [
                    "Tests von Banking-Webportalen und rund 600 Testfälle in TestRail geschrieben.",
                    "Einen Rundungsfehler bei Zahlungen vor dem Release gefunden und dokumentiert.",
                ],
                skills: ["TestRail", "Jira", "SQL"],
            },
        ],
        education: [
            {
                id: "edu-1",
                institution: "International Burch University, Sarajevo",
                area: "Informationstechnologien",
                studyType: "Bachelor of Science",
                start: "2015-10",
                end: "2019-07",
                location: "Sarajevo",
            },
        ],
        skillGroups: [
            {
                id: "group-main",
                name: "",
                skills: [
                    { id: "skill-1", name: "Testautomatisierung (Playwright)", level: "expert" },
                    { id: "skill-2", name: "API-Tests (Postman)", level: "proficient" },
                    { id: "skill-3", name: "Testentwurf und Testplanung", level: "expert" },
                    { id: "skill-4", name: "Jira und TestRail", level: "expert" },
                    { id: "skill-5", name: "SQL", level: "competent" },
                ],
            },
        ],
        languages: [
            { id: "lang-1", language: "Bosnisch", fluency: "Native" },
            {
                id: "lang-2",
                language: "Englisch",
                fluency: "C1",
                cefrDetailed: true,
                cefr: { listening: "C1", reading: "C1", spokenInteraction: "C1", spokenProduction: "B2", writing: "C1" },
            },
            {
                id: "lang-3",
                language: "Deutsch",
                fluency: "A2",
                cefrDetailed: true,
                cefr: { listening: "A2", reading: "A2", spokenInteraction: "A2", spokenProduction: "A2", writing: "A1" },
            },
        ],
    }),
};

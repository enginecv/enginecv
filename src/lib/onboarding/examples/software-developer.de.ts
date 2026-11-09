import type { ExampleResumeInput } from "./types";

/**
 * German version of the software developer example, used by the public role
 * example pages (#64). It is deliberately not part of `software-developer.ts`:
 * adding `de` there would put unreviewed German into the first-run picker for
 * every German visitor People and contact
 * details are fictional.
 */
export const de = (): ExampleResumeInput => ({
    description: "Beispiel-Lebenslauf: Full-Stack-Entwickler.",
    basics: {
        name: "John Doe",
        headline: "Full-Stack-Entwickler — TypeScript, React, Node.js",
        email: "john.doe@example.com",
        phone: "+387 61 000 001",
        location: "Sarajevo, Bosnien und Herzegowina (remote möglich)",
        summary:
            "Full-Stack-Entwickler mit fünf Jahren Erfahrung in der Entwicklung von Webanwendungen für Kunden aus "
            + "Logistik und Fintech. Mir sind lesbarer Code, schnelle Seiten und Tests wichtig, die echte Fehler finden. "
            + "Ich suche ein Produktteam im DACH-Raum.",
    },
    experience: [
        {
            id: "exp-1",
            company: "Blueline Logistics",
            position: "Senior Full-Stack-Entwickler",
            start: "2023-02",
            end: "Present",
            location: "Remote",
            highlights: [
                "Neuentwicklung der Sendungsverfolgung in React und TypeScript; die Ladezeit sank von 4,1 s auf 1,3 s.",
                "Entwurf einer Node.js-API für 40 Partneranbindungen mit Contract-Tests in der CI-Pipeline.",
            ],
            skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
        },
        {
            id: "exp-2",
            company: "Kvadrat Software",
            position: "Full-Stack-Entwickler",
            start: "2020-09",
            end: "2023-01",
            location: "Sarajevo",
            highlights: [
                "Entwicklung von Zahlungs- und Berichtsfunktionen für das Kundenportal einer Bank.",
                "Einführung von End-to-End-Tests mit Playwright; Fehler nach Releases halbierten sich.",
            ],
            skills: ["JavaScript", "Vue", "Java", "Docker"],
        },
    ],
    education: [
        {
            id: "edu-1",
            institution: "Universität Sarajevo, Fakultät für Elektrotechnik",
            area: "Informatik",
            studyType: "Bachelor of Science",
            start: "2016-10",
            end: "2020-07",
            location: "Sarajevo",
        },
    ],
    skillGroups: [
        {
            id: "group-main",
            name: "",
            skills: [
                { id: "skill-1", name: "TypeScript", level: "expert" },
                { id: "skill-2", name: "React", level: "expert" },
                { id: "skill-4", name: "Node.js", level: "proficient" },
                { id: "skill-5", name: "PostgreSQL", level: "proficient" },
                { id: "skill-6", name: "Docker", level: "competent" },
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
            cefr: { listening: "C1", reading: "C2", spokenInteraction: "C1", spokenProduction: "C1", writing: "C1" },
        },
        {
            id: "lang-3",
            language: "Deutsch",
            fluency: "B1",
            cefrDetailed: true,
            cefr: { listening: "B1", reading: "B2", spokenInteraction: "B1", spokenProduction: "B1", writing: "A2" },
        },
    ],
});

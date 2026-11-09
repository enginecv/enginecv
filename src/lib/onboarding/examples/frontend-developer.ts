import type { ExampleContent } from "./types";

/** Role example (#64). The person and all contact details are fictional. */
export const content: ExampleContent = {
    en: () => ({
        description: "Example CV: frontend developer.",
        basics: {
            name: "Jane Doe",
            headline: "Frontend Developer — React, TypeScript, Accessibility",
            email: "jane.doe@example.com",
            phone: "+387 61 000 003",
            location: "Zenica, Bosnia and Herzegovina (open to relocation)",
            summary:
                "Frontend developer with four years of experience building fast, accessible interfaces for e-commerce and "
                + "SaaS products. I work closely with designers, write component tests and care about keyboard and "
                + "screen-reader support. Looking for a product team in Germany, Austria or Switzerland.",
        },
        experience: [
            {
                id: "exp-1",
                company: "Shopline Digital",
                position: "Frontend Developer",
                start: "2024-01",
                end: "Present",
                location: "Remote",
                highlights: [
                    "Rebuilt the checkout in React and TypeScript; completed orders rose by 9% and the largest bundle shrank by 38%.",
                    "Introduced a shared component library with accessibility tests, used by four product teams.",
                ],
                skills: ["React", "TypeScript", "Storybook", "Playwright"],
            },
            {
                id: "exp-2",
                company: "Brightpixel Agency",
                position: "Junior Frontend Developer",
                start: "2022-06",
                end: "2023-12",
                location: "Zenica",
                highlights: [
                    "Delivered 12 responsive marketing sites for regional clients, all above 90 in Lighthouse performance.",
                    "Moved the agency's projects from jQuery to Vue and later React with reusable patterns.",
                ],
                skills: ["JavaScript", "Vue", "CSS", "Figma"],
            },
        ],
        education: [
            {
                id: "edu-1",
                institution: "University of Zenica, Faculty of Engineering",
                area: "Software Engineering",
                studyType: "BSc",
                start: "2018-10",
                end: "2022-07",
                location: "Zenica",
            },
        ],
        skillGroups: [
            {
                id: "group-main",
                name: "",
                skills: [
                    { id: "skill-1", name: "React", level: "expert" },
                    { id: "skill-2", name: "TypeScript", level: "proficient" },
                    { id: "skill-3", name: "HTML and CSS", level: "expert" },
                    { id: "skill-4", name: "Web accessibility (WCAG)", level: "proficient" },
                    { id: "skill-5", name: "Testing (Vitest, Playwright)", level: "competent" },
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
                cefr: { listening: "C1", reading: "C2", spokenInteraction: "C1", spokenProduction: "C1", writing: "C1" },
            },
            {
                id: "lang-3",
                language: "German",
                fluency: "A2",
                cefrDetailed: true,
                cefr: { listening: "A2", reading: "B1", spokenInteraction: "A2", spokenProduction: "A2", writing: "A2" },
            },
        ],
    }),
    de: () => ({
        description: "Beispiel-Lebenslauf: Frontend-Entwicklerin.",
        basics: {
            name: "Jane Doe",
            headline: "Frontend-Entwicklerin — React, TypeScript, Barrierefreiheit",
            email: "jane.doe@example.com",
            phone: "+387 61 000 003",
            location: "Zenica, Bosnien und Herzegowina (Umzug möglich)",
            summary:
                "Frontend-Entwicklerin mit vier Jahren Erfahrung in der Entwicklung schneller, barrierefreier Oberflächen für "
                + "E-Commerce- und SaaS-Produkte. Ich arbeite eng mit Designern zusammen, schreibe Komponententests und achte "
                + "auf Tastatur- und Screenreader-Unterstützung. Ich suche ein Produktteam in Deutschland, Österreich oder der Schweiz.",
        },
        experience: [
            {
                id: "exp-1",
                company: "Shopline Digital",
                position: "Frontend-Entwicklerin",
                start: "2024-01",
                end: "Present",
                location: "Remote",
                highlights: [
                    "Neuaufbau des Checkouts in React und TypeScript; abgeschlossene Bestellungen stiegen um 9 %, das größte Bundle wurde um 38 % kleiner.",
                    "Einführung einer gemeinsamen Komponentenbibliothek mit Barrierefreiheitstests, genutzt von vier Produktteams.",
                ],
                skills: ["React", "TypeScript", "Storybook", "Playwright"],
            },
            {
                id: "exp-2",
                company: "Brightpixel Agency",
                position: "Junior Frontend-Entwicklerin",
                start: "2022-06",
                end: "2023-12",
                location: "Zenica",
                highlights: [
                    "Umsetzung von 12 responsiven Webseiten für regionale Kunden, alle mit über 90 Punkten bei Lighthouse-Performance.",
                    "Umstellung der Agenturprojekte von jQuery auf Vue und später React mit wiederverwendbaren Mustern.",
                ],
                skills: ["JavaScript", "Vue", "CSS", "Figma"],
            },
        ],
        education: [
            {
                id: "edu-1",
                institution: "Universität Zenica, Fakultät für Ingenieurwesen",
                area: "Softwaretechnik",
                studyType: "Bachelor of Science",
                start: "2018-10",
                end: "2022-07",
                location: "Zenica",
            },
        ],
        skillGroups: [
            {
                id: "group-main",
                name: "",
                skills: [
                    { id: "skill-1", name: "React", level: "expert" },
                    { id: "skill-2", name: "TypeScript", level: "proficient" },
                    { id: "skill-3", name: "HTML und CSS", level: "expert" },
                    { id: "skill-4", name: "Barrierefreiheit (WCAG)", level: "proficient" },
                    { id: "skill-5", name: "Tests (Vitest, Playwright)", level: "competent" },
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
                fluency: "A2",
                cefrDetailed: true,
                cefr: { listening: "A2", reading: "B1", spokenInteraction: "A2", spokenProduction: "A2", writing: "A2" },
            },
        ],
    }),
};

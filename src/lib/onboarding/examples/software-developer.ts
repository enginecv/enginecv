import type { ExampleContent } from "./types";

export const content: ExampleContent = {
    en: () => ({
        description: "Example CV: full-stack developer.",
        basics: {
            name: "John Doe",
            headline: "Full-Stack Developer — TypeScript, React, Node.js",
            email: "john.doe@example.com",
            phone: "+387 61 000 001",
            location: "Sarajevo, Bosnia and Herzegovina (open to remote)",
            summary:
                "Full-stack developer with five years of experience building web applications "
                + "for logistics and fintech clients. I care about readable code, fast pages and "
                + "tests that catch real bugs. Looking for a product team in the DACH region.",
        },
        experience: [
            {
                id: "exp-1",
                company: "Blueline Logistics",
                position: "Senior Full-Stack Developer",
                start: "2023-02",
                end: "Present",
                location: "Remote",
                highlights: [
                    "Rebuilt the shipment tracking app in React and TypeScript; page load fell from 4.1 s to 1.3 s.",
                    "Designed a Node.js API for 40 partner integrations with contract tests in CI.",
                ],
                skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
            },
            {
                id: "exp-2",
                company: "Kvadrat Software",
                position: "Full-Stack Developer",
                start: "2020-09",
                end: "2023-01",
                location: "Sarajevo",
                highlights: [
                    "Built payment and reporting features for a banking client's customer portal.",
                    "Introduced end-to-end tests with Playwright, cutting release regressions by half.",
                ],
                skills: ["JavaScript", "Vue", "Java", "Docker"],
            },
        ],
        education: [
            {
                id: "edu-1",
                institution: "University of Sarajevo, Faculty of Electrical Engineering",
                area: "Computer Science and Informatics",
                studyType: "BSc",
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
                fluency: "B1",
                cefrDetailed: true,
                cefr: { listening: "B1", reading: "B2", spokenInteraction: "B1", spokenProduction: "B1", writing: "A2" },
            },
        ],
    }),
};

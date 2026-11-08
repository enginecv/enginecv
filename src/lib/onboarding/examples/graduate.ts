import type { ExampleContent } from "./types";

export const content: ExampleContent = {
    en: () => ({
        description: "Example CV: computer science graduate.",
        basics: {
            name: "Tarik Mehić",
            headline: "Computer Science Graduate — Junior Developer",
            email: "tarik.mehic@example.com",
            phone: "+387 62 000 004",
            location: "Zenica, Bosnia and Herzegovina",
            summary:
                "Recent computer science graduate with an internship in web development and a "
                + "thesis on route planning. Looking for my first full-time role as a junior developer.",
        },
        experience: [
            {
                id: "exp-1",
                company: "Pixel Lab",
                position: "Software Development Intern",
                start: "2025-07",
                end: "2025-12",
                location: "Sarajevo (hybrid)",
                highlights: [
                    "Built a React and TypeScript admin screen for product images.",
                    "Wrote unit tests for the pricing module and fixed eight bugs.",
                ],
                skills: ["React", "TypeScript", "Git"],
            },
            {
                id: "exp-2",
                company: "University IT Centre",
                position: "Student Assistant",
                start: "2023-10",
                end: "2025-06",
                location: "Zenica",
                highlights: [
                    "Helped students and staff with accounts and the learning platform.",
                ],
            },
        ],
        education: [
            {
                id: "edu-1",
                institution: "University of Zenica, Polytechnic Faculty",
                area: "Computer Science",
                studyType: "BSc",
                start: "2021-10",
                end: "2025-09",
                location: "Zenica",
                score: "8.9 / 10",
                description: "Thesis: shortest routes for city delivery bikes with time windows.",
            },
        ],
        skillGroups: [
            {
                id: "group-main",
                name: "",
                skills: [
                    { id: "skill-1", name: "JavaScript and TypeScript", level: "proficient" },
                    { id: "skill-2", name: "Python", level: "proficient" },
                    { id: "skill-3", name: "Java", level: "competent" },
                    { id: "skill-4", name: "SQL", level: "competent" },
                    { id: "skill-5", name: "Git and GitHub", level: "proficient" },
                ],
            },
        ],
        languages: [
            { id: "lang-1", language: "Bosnian", fluency: "Native" },
            {
                id: "lang-2",
                language: "English",
                fluency: "B2",
                cefrDetailed: true,
                cefr: { listening: "C1", reading: "B2", spokenInteraction: "B2", spokenProduction: "B2", writing: "B2" },
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
};

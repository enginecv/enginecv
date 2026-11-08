import type { ExampleContent } from "./types";

export const content: ExampleContent = {
    en: () => ({
        description: "Example CV: registered nurse.",
        basics: {
            name: "Amra Begović",
            headline: "Registered Nurse — Intensive Care",
            email: "amra.begovic@example.com",
            phone: "+387 61 000 002",
            location: "Tuzla, Bosnia and Herzegovina",
            summary:
                "Registered nurse with seven years of experience, four of them in intensive care. "
                + "Calm under pressure, careful with documentation and used to working in "
                + "multidisciplinary teams. German at B2, preparing for professional recognition "
                + "in Germany.",
        },
        experience: [
            {
                id: "exp-1",
                company: "Regional Hospital Centre",
                position: "Registered Nurse, Intensive Care Unit",
                start: "2021-04",
                end: "Present",
                location: "Tuzla",
                highlights: [
                    "Care for up to three ventilated patients per shift in a 12-bed ICU.",
                    "Monitor vital signs and manage infusions and central lines.",
                    "Introduced a bedside handover checklist now used on every shift.",
                ],
            },
            {
                id: "exp-2",
                company: "Regional Hospital Centre",
                position: "Registered Nurse, Internal Medicine",
                start: "2018-09",
                end: "2021-03",
                location: "Tuzla",
                highlights: [
                    "Cared for 8–10 patients per shift, incl. medication rounds and wound care.",
                ],
            },
        ],
        education: [
            {
                id: "edu-1",
                institution: "University of Tuzla, Faculty of Health Studies",
                area: "Nursing",
                studyType: "BSc",
                start: "2014-10",
                end: "2018-07",
                location: "Tuzla",
            },
        ],
        skillGroups: [
            {
                id: "group-main",
                name: "",
                skills: [
                    { id: "skill-1", name: "Intensive care nursing", level: "expert" },
                    { id: "skill-2", name: "Ventilation care", level: "proficient" },
                    { id: "skill-3", name: "Medication management", level: "expert" },
                    { id: "skill-4", name: "BLS and ALS", level: "proficient" },
                    { id: "skill-5", name: "Care documentation", level: "expert" },
                ],
            },
        ],
        languages: [
            { id: "lang-1", language: "Bosnian", fluency: "Native" },
            {
                id: "lang-2",
                language: "German",
                fluency: "B2",
                cefrDetailed: true,
                cefr: { listening: "B2", reading: "B2", spokenInteraction: "B2", spokenProduction: "B2", writing: "B1" },
                assessmentType: "issuer",
                issuer: "Goethe-Institut (Goethe-Zertifikat B2)",
            },
            {
                id: "lang-3",
                language: "English",
                fluency: "B1",
                cefrDetailed: true,
                cefr: { listening: "B2", reading: "B1", spokenInteraction: "B1", spokenProduction: "B1", writing: "B1" },
            },
        ],
    }),
};

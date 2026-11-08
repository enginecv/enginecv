import type { ExampleResumeInput } from "./types";

/**
 * German version of the nurse example, used by the public role example pages
 * (#64). It is deliberately not part of `nurse.ts`: adding `de` there would put
 * unreviewed German into the first-run picker for every German visitor
 * (specs/038-first-run-onboarding). People and contact details are fictional.
 */
export const de = (): ExampleResumeInput => ({
    description: "Beispiel-Lebenslauf: Pflegefachkraft.",
    basics: {
        name: "Amra Begović",
        headline: "Gesundheits- und Krankenpflegerin — Intensivpflege",
        email: "amra.begovic@example.com",
        phone: "+387 61 000 002",
        location: "Tuzla, Bosnien und Herzegowina",
        summary:
            "Examinierte Pflegefachkraft mit sieben Jahren Berufserfahrung, davon vier Jahre auf der Intensivstation. "
            + "Belastbar in Notfallsituationen, sorgfältig in der Pflegedokumentation und erfahren in der Zusammenarbeit "
            + "im multiprofessionellen Team. Deutsch auf Niveau B2, Anerkennungsverfahren in Deutschland in Vorbereitung.",
    },
    experience: [
        {
            id: "exp-1",
            company: "Regionales Klinikzentrum",
            position: "Gesundheits- und Krankenpflegerin, Intensivstation",
            start: "2021-04",
            end: "Present",
            location: "Tuzla",
            highlights: [
                "Pflege von bis zu drei beatmeten Patienten pro Schicht auf einer Intensivstation mit 12 Betten.",
                "Überwachung der Vitalparameter, Verwaltung von Infusionen und zentralen Venenkathetern.",
                "Einführung einer Checkliste für die Übergabe am Patientenbett, die heute in jeder Schicht genutzt wird.",
            ],
        },
        {
            id: "exp-2",
            company: "Regionales Klinikzentrum",
            position: "Gesundheits- und Krankenpflegerin, Innere Medizin",
            start: "2018-09",
            end: "2021-03",
            location: "Tuzla",
            highlights: [
                "Versorgung von 8–10 Patienten pro Schicht, einschließlich Medikamentenausgabe und Wundversorgung.",
            ],
        },
    ],
    education: [
        {
            id: "edu-1",
            institution: "Universität Tuzla, Fakultät für Gesundheitswissenschaften",
            area: "Pflege",
            studyType: "Bachelor of Science",
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
                { id: "skill-1", name: "Intensivpflege", level: "expert" },
                { id: "skill-2", name: "Pflege beatmeter Patienten", level: "proficient" },
                { id: "skill-3", name: "Medikamentenmanagement", level: "expert" },
                { id: "skill-4", name: "Basic und Advanced Life Support", level: "proficient" },
                { id: "skill-5", name: "Pflegedokumentation", level: "expert" },
            ],
        },
    ],
    languages: [
        { id: "lang-1", language: "Bosnisch", fluency: "Native" },
        {
            id: "lang-2",
            language: "Deutsch",
            fluency: "B2",
            cefrDetailed: true,
            cefr: { listening: "B2", reading: "B2", spokenInteraction: "B2", spokenProduction: "B2", writing: "B1" },
            assessmentType: "issuer",
            issuer: "Goethe-Institut (Goethe-Zertifikat B2)",
        },
        {
            id: "lang-3",
            language: "Englisch",
            fluency: "B1",
            cefrDetailed: true,
            cefr: { listening: "B2", reading: "B1", spokenInteraction: "B1", spokenProduction: "B1", writing: "B1" },
        },
    ],
});

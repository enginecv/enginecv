import type { ExampleContent } from "./types";

/** Role example (#64). The person and all contact details are fictional. */
export const content: ExampleContent = {
    en: () => ({
        description: "Example CV: data analyst.",
        basics: {
            name: "Jane Doe",
            headline: "Data Analyst — SQL, Python, Power BI",
            email: "jane.doe@example.com",
            phone: "+387 61 000 006",
            location: "Tuzla, Bosnia and Herzegovina (open to relocation)",
            summary:
                "Data analyst with four years of experience turning sales and operations data into decisions. I write clean "
                + "SQL, automate reports in Python and build dashboards that managers actually open. Looking for an analytics "
                + "team in Germany, Austria or Switzerland.",
        },
        experience: [
            {
                id: "exp-1",
                company: "Retailmax Group",
                position: "Data Analyst",
                start: "2023-02",
                end: "Present",
                location: "Tuzla",
                highlights: [
                    "Replaced 14 manual Excel reports with automated Power BI dashboards, saving about 25 hours a week.",
                    "Found a stock-planning gap that cut write-offs by 12% across 60 stores.",
                    "Present monthly findings to the management board in plain language.",
                ],
                skills: ["SQL", "Power BI", "Python", "Excel"],
            },
            {
                id: "exp-2",
                company: "Marketlab Research",
                position: "Junior Analyst",
                start: "2021-09",
                end: "2023-01",
                location: "Tuzla",
                highlights: [
                    "Cleaned and merged survey data from 5,000 respondents with pandas.",
                    "Built the weekly KPI report used by the sales team.",
                ],
                skills: ["Python", "pandas", "SQL"],
            },
        ],
        education: [
            {
                id: "edu-1",
                institution: "University of Tuzla, Faculty of Economics",
                area: "Business Informatics",
                studyType: "BSc",
                start: "2017-10",
                end: "2021-07",
                location: "Tuzla",
            },
        ],
        skillGroups: [
            {
                id: "group-main",
                name: "",
                skills: [
                    { id: "skill-1", name: "SQL", level: "expert" },
                    { id: "skill-2", name: "Power BI", level: "expert" },
                    { id: "skill-3", name: "Python (pandas)", level: "proficient" },
                    { id: "skill-4", name: "Excel", level: "expert" },
                    { id: "skill-5", name: "Statistics", level: "competent" },
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
                cefr: { listening: "C1", reading: "C1", spokenInteraction: "B2", spokenProduction: "B2", writing: "C1" },
            },
            {
                id: "lang-3",
                language: "German",
                fluency: "B2",
                cefrDetailed: true,
                cefr: { listening: "B2", reading: "B2", spokenInteraction: "B2", spokenProduction: "B1", writing: "B1" },
                assessmentType: "issuer",
                issuer: "telc (Deutsch B2)",
            },
        ],
    }),
    de: () => ({
        description: "Beispiel-Lebenslauf: Datenanalystin.",
        basics: {
            name: "Jane Doe",
            headline: "Datenanalystin — SQL, Python, Power BI",
            email: "jane.doe@example.com",
            phone: "+387 61 000 006",
            location: "Tuzla, Bosnien und Herzegowina (Umzug möglich)",
            summary:
                "Datenanalystin mit vier Jahren Erfahrung darin, Vertriebs- und Betriebsdaten in Entscheidungen zu verwandeln. "
                + "Ich schreibe sauberes SQL, automatisiere Berichte in Python und baue Dashboards, die Führungskräfte tatsächlich "
                + "öffnen. Ich suche ein Analytics-Team in Deutschland, Österreich oder der Schweiz.",
        },
        experience: [
            {
                id: "exp-1",
                company: "Retailmax Group",
                position: "Datenanalystin",
                start: "2023-02",
                end: "Present",
                location: "Tuzla",
                highlights: [
                    "14 manuelle Excel-Berichte durch automatisierte Power-BI-Dashboards ersetzt; Ersparnis von etwa 25 Stunden pro Woche.",
                    "Eine Lücke in der Bestandsplanung entdeckt, die die Abschreibungen in 60 Filialen um 12 % senkte.",
                    "Monatliche Ergebnisse verständlich vor der Geschäftsleitung präsentiert.",
                ],
                skills: ["SQL", "Power BI", "Python", "Excel"],
            },
            {
                id: "exp-2",
                company: "Marketlab Research",
                position: "Junior-Analystin",
                start: "2021-09",
                end: "2023-01",
                location: "Tuzla",
                highlights: [
                    "Bereinigung und Zusammenführung von Umfragedaten von 5.000 Befragten mit pandas.",
                    "Aufbau des wöchentlichen Kennzahlenberichts für das Vertriebsteam.",
                ],
                skills: ["Python", "pandas", "SQL"],
            },
        ],
        education: [
            {
                id: "edu-1",
                institution: "Universität Tuzla, Wirtschaftswissenschaftliche Fakultät",
                area: "Wirtschaftsinformatik",
                studyType: "Bachelor of Science",
                start: "2017-10",
                end: "2021-07",
                location: "Tuzla",
            },
        ],
        skillGroups: [
            {
                id: "group-main",
                name: "",
                skills: [
                    { id: "skill-1", name: "SQL", level: "expert" },
                    { id: "skill-2", name: "Power BI", level: "expert" },
                    { id: "skill-3", name: "Python (pandas)", level: "proficient" },
                    { id: "skill-4", name: "Excel", level: "expert" },
                    { id: "skill-5", name: "Statistik", level: "competent" },
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
                cefr: { listening: "C1", reading: "C1", spokenInteraction: "B2", spokenProduction: "B2", writing: "C1" },
            },
            {
                id: "lang-3",
                language: "Deutsch",
                fluency: "B2",
                cefrDetailed: true,
                cefr: { listening: "B2", reading: "B2", spokenInteraction: "B2", spokenProduction: "B1", writing: "B1" },
                assessmentType: "issuer",
                issuer: "telc (Deutsch B2)",
            },
        ],
    }),
};

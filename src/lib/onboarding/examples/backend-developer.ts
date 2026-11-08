import type { ExampleContent } from "./types";

/** Role example (#64). The person and all contact details are fictional. */
export const content: ExampleContent = {
    en: () => ({
        description: "Example CV: backend developer.",
        basics: {
            name: "Haris Kovačević",
            headline: "Backend Developer — Java, Spring Boot, PostgreSQL",
            email: "haris.kovacevic@example.com",
            phone: "+387 61 000 004",
            location: "Banja Luka, Bosnia and Herzegovina (open to relocation)",
            summary:
                "Backend developer with six years of experience in Java services for banking and insurance. I design "
                + "stable APIs, keep databases fast under load and document what I build. German at B1, learning toward B2. "
                + "Looking for a backend team in the DACH region.",
        },
        experience: [
            {
                id: "exp-1",
                company: "Nordbank Services",
                position: "Senior Backend Developer",
                start: "2022-03",
                end: "Present",
                location: "Banja Luka",
                highlights: [
                    "Split a monolithic payment module into three Spring Boot services; deployment time fell from 90 to 15 minutes.",
                    "Cut the slowest report query from 11 s to 0.8 s with new indexes and a read replica.",
                    "Mentor two junior developers through code review and weekly pairing.",
                ],
                skills: ["Java", "Spring Boot", "PostgreSQL", "Kafka"],
            },
            {
                id: "exp-2",
                company: "Insurewise Software",
                position: "Backend Developer",
                start: "2019-09",
                end: "2022-02",
                location: "Banja Luka",
                highlights: [
                    "Built REST APIs for policy management used by 150 broker offices.",
                    "Raised unit test coverage on core modules from 31% to 78%.",
                ],
                skills: ["Java", "Hibernate", "Docker", "Jenkins"],
            },
        ],
        education: [
            {
                id: "edu-1",
                institution: "University of Banja Luka, Faculty of Electrical Engineering",
                area: "Computer Science",
                studyType: "BSc",
                start: "2015-10",
                end: "2019-07",
                location: "Banja Luka",
            },
        ],
        skillGroups: [
            {
                id: "group-main",
                name: "",
                skills: [
                    { id: "skill-1", name: "Java", level: "expert" },
                    { id: "skill-2", name: "Spring Boot", level: "expert" },
                    { id: "skill-3", name: "PostgreSQL", level: "proficient" },
                    { id: "skill-4", name: "Apache Kafka", level: "competent" },
                    { id: "skill-5", name: "REST API design", level: "expert" },
                ],
            },
        ],
        languages: [
            { id: "lang-1", language: "Serbian", fluency: "Native" },
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
                fluency: "B1",
                cefrDetailed: true,
                cefr: { listening: "B1", reading: "B1", spokenInteraction: "B1", spokenProduction: "B1", writing: "A2" },
                assessmentType: "issuer",
                issuer: "Goethe-Institut (Goethe-Zertifikat B1)",
            },
        ],
    }),
    de: () => ({
        description: "Beispiel-Lebenslauf: Backend-Entwickler.",
        basics: {
            name: "Haris Kovačević",
            headline: "Backend-Entwickler — Java, Spring Boot, PostgreSQL",
            email: "haris.kovacevic@example.com",
            phone: "+387 61 000 004",
            location: "Banja Luka, Bosnien und Herzegowina (Umzug möglich)",
            summary:
                "Backend-Entwickler mit sechs Jahren Erfahrung in Java-Diensten für Banken und Versicherungen. Ich entwerfe "
                + "stabile Schnittstellen, halte Datenbanken unter Last schnell und dokumentiere, was ich baue. Deutsch auf "
                + "Niveau B1, auf dem Weg zu B2. Ich suche ein Backend-Team im DACH-Raum.",
        },
        experience: [
            {
                id: "exp-1",
                company: "Nordbank Services",
                position: "Senior Backend-Entwickler",
                start: "2022-03",
                end: "Present",
                location: "Banja Luka",
                highlights: [
                    "Aufteilung eines monolithischen Zahlungsmoduls in drei Spring-Boot-Dienste; die Bereitstellung sank von 90 auf 15 Minuten.",
                    "Die langsamste Berichtsabfrage von 11 s auf 0,8 s verkürzt, durch neue Indizes und ein Read-Replikat.",
                    "Betreuung von zwei Nachwuchsentwicklern durch Code-Reviews und wöchentliches Pair Programming.",
                ],
                skills: ["Java", "Spring Boot", "PostgreSQL", "Kafka"],
            },
            {
                id: "exp-2",
                company: "Insurewise Software",
                position: "Backend-Entwickler",
                start: "2019-09",
                end: "2022-02",
                location: "Banja Luka",
                highlights: [
                    "Entwicklung von REST-Schnittstellen für die Policenverwaltung, genutzt von 150 Maklerbüros.",
                    "Testabdeckung der Kernmodule von 31 % auf 78 % erhöht.",
                ],
                skills: ["Java", "Hibernate", "Docker", "Jenkins"],
            },
        ],
        education: [
            {
                id: "edu-1",
                institution: "Universität Banja Luka, Fakultät für Elektrotechnik",
                area: "Informatik",
                studyType: "Bachelor of Science",
                start: "2015-10",
                end: "2019-07",
                location: "Banja Luka",
            },
        ],
        skillGroups: [
            {
                id: "group-main",
                name: "",
                skills: [
                    { id: "skill-1", name: "Java", level: "expert" },
                    { id: "skill-2", name: "Spring Boot", level: "expert" },
                    { id: "skill-3", name: "PostgreSQL", level: "proficient" },
                    { id: "skill-4", name: "Apache Kafka", level: "competent" },
                    { id: "skill-5", name: "REST-API-Design", level: "expert" },
                ],
            },
        ],
        languages: [
            { id: "lang-1", language: "Serbisch", fluency: "Native" },
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
                fluency: "B1",
                cefrDetailed: true,
                cefr: { listening: "B1", reading: "B1", spokenInteraction: "B1", spokenProduction: "B1", writing: "A2" },
                assessmentType: "issuer",
                issuer: "Goethe-Institut (Goethe-Zertifikat B1)",
            },
        ],
    }),
};

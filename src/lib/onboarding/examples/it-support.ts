import type { ExampleContent } from "./types";

/** Role example (#64). The person and all contact details are fictional. */
export const content: ExampleContent = {
    en: () => ({
        description: "Example CV: IT support specialist.",
        basics: {
            name: "John Doe",
            headline: "IT Support Specialist — Microsoft 365, Windows, Helpdesk",
            email: "john.doe@example.com",
            phone: "+387 61 000 008",
            location: "Bihać, Bosnia and Herzegovina (open to relocation)",
            summary:
                "IT support specialist with four years of experience helping 300 employees with hardware, accounts and "
                + "software. Patient with non-technical users, careful with documentation and quick to find the cause of a "
                + "problem. German at B1. Looking for a helpdesk or service desk role in the DACH region.",
        },
        experience: [
            {
                id: "exp-1",
                company: "Pannonia Logistics",
                position: "IT Support Specialist",
                start: "2023-03",
                end: "Present",
                location: "Bihać",
                highlights: [
                    "Resolve about 40 tickets a week in a two-person team with a first-contact fix rate of 72%.",
                    "Rolled out Windows 11 and Microsoft 365 to 300 laptops with a scripted setup that takes 20 minutes per device.",
                    "Wrote 35 how-to articles that cut repeat tickets for password and VPN problems by a third.",
                ],
                skills: ["Microsoft 365", "Active Directory", "Windows 11", "Jira Service Management"],
            },
            {
                id: "exp-2",
                company: "Compuhelp Servis",
                position: "Computer Technician",
                start: "2021-06",
                end: "2023-02",
                location: "Bihać",
                highlights: [
                    "Repaired and upgraded desktops and laptops for small businesses and households.",
                    "Set up and secured small office networks, including backups and shared printers.",
                ],
                skills: ["Hardware repair", "Networking", "Windows"],
            },
        ],
        education: [
            {
                id: "edu-1",
                institution: "Technical School Bihać",
                area: "Computer Technology",
                studyType: "Secondary school diploma",
                start: "2017-09",
                end: "2021-06",
                location: "Bihać",
            },
        ],
        skillGroups: [
            {
                id: "group-main",
                name: "",
                skills: [
                    { id: "skill-1", name: "Microsoft 365 administration", level: "proficient" },
                    { id: "skill-2", name: "Active Directory", level: "proficient" },
                    { id: "skill-3", name: "Windows and macOS support", level: "expert" },
                    { id: "skill-4", name: "Networking basics (TCP/IP, DHCP, DNS)", level: "competent" },
                    { id: "skill-5", name: "Ticket systems", level: "expert" },
                ],
            },
        ],
        languages: [
            { id: "lang-1", language: "Bosnian", fluency: "Native" },
            {
                id: "lang-2",
                language: "German",
                fluency: "B1",
                cefrDetailed: true,
                cefr: { listening: "B1", reading: "B1", spokenInteraction: "B1", spokenProduction: "B1", writing: "A2" },
                assessmentType: "issuer",
                issuer: "Goethe-Institut (Goethe-Zertifikat B1)",
            },
            {
                id: "lang-3",
                language: "English",
                fluency: "B2",
                cefrDetailed: true,
                cefr: { listening: "B2", reading: "B2", spokenInteraction: "B2", spokenProduction: "B1", writing: "B1" },
            },
        ],
    }),
    de: () => ({
        description: "Beispiel-Lebenslauf: IT-Support-Mitarbeiter.",
        basics: {
            name: "John Doe",
            headline: "IT-Support-Mitarbeiter — Microsoft 365, Windows, Helpdesk",
            email: "john.doe@example.com",
            phone: "+387 61 000 008",
            location: "Bihać, Bosnien und Herzegowina (Umzug möglich)",
            summary:
                "IT-Support-Mitarbeiter mit vier Jahren Erfahrung in der Unterstützung von 300 Beschäftigten bei Hardware, "
                + "Konten und Software. Geduldig im Umgang mit technisch weniger erfahrenen Nutzern, sorgfältig in der "
                + "Dokumentation und schnell bei der Ursachensuche. Deutsch auf Niveau B1. Ich suche eine Stelle im Helpdesk "
                + "oder Service Desk im DACH-Raum.",
        },
        experience: [
            {
                id: "exp-1",
                company: "Pannonia Logistics",
                position: "IT-Support-Mitarbeiter",
                start: "2023-03",
                end: "Present",
                location: "Bihać",
                highlights: [
                    "Bearbeitung von etwa 40 Tickets pro Woche in einem Zweierteam, mit einer Erstlösungsquote von 72 %.",
                    "Einführung von Windows 11 und Microsoft 365 auf 300 Laptops mit einer skriptgesteuerten Einrichtung von 20 Minuten pro Gerät.",
                    "35 Anleitungen geschrieben, die wiederkehrende Tickets zu Passwort- und VPN-Problemen um ein Drittel senkten.",
                ],
                skills: ["Microsoft 365", "Active Directory", "Windows 11", "Jira Service Management"],
            },
            {
                id: "exp-2",
                company: "Compuhelp Servis",
                position: "Computertechniker",
                start: "2021-06",
                end: "2023-02",
                location: "Bihać",
                highlights: [
                    "Reparatur und Aufrüstung von Desktop-PCs und Laptops für Kleinunternehmen und Privatkunden.",
                    "Einrichtung und Absicherung kleiner Büronetzwerke, einschließlich Datensicherung und gemeinsamer Drucker.",
                ],
                skills: ["Hardware-Reparatur", "Netzwerke", "Windows"],
            },
        ],
        education: [
            {
                id: "edu-1",
                institution: "Technische Schule Bihać",
                area: "Computertechnik",
                studyType: "Mittlerer Schulabschluss",
                start: "2017-09",
                end: "2021-06",
                location: "Bihać",
            },
        ],
        skillGroups: [
            {
                id: "group-main",
                name: "",
                skills: [
                    { id: "skill-1", name: "Microsoft-365-Administration", level: "proficient" },
                    { id: "skill-2", name: "Active Directory", level: "proficient" },
                    { id: "skill-3", name: "Windows- und macOS-Support", level: "expert" },
                    { id: "skill-4", name: "Netzwerkgrundlagen (TCP/IP, DHCP, DNS)", level: "competent" },
                    { id: "skill-5", name: "Ticketsysteme", level: "expert" },
                ],
            },
        ],
        languages: [
            { id: "lang-1", language: "Bosnisch", fluency: "Native" },
            {
                id: "lang-2",
                language: "Deutsch",
                fluency: "B1",
                cefrDetailed: true,
                cefr: { listening: "B1", reading: "B1", spokenInteraction: "B1", spokenProduction: "B1", writing: "A2" },
                assessmentType: "issuer",
                issuer: "Goethe-Institut (Goethe-Zertifikat B1)",
            },
            {
                id: "lang-3",
                language: "Englisch",
                fluency: "B2",
                cefrDetailed: true,
                cefr: { listening: "B2", reading: "B2", spokenInteraction: "B2", spokenProduction: "B1", writing: "B1" },
            },
        ],
    }),
};

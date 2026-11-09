import type { ExampleContent } from "./types";

/** Role example (#64). The person and all contact details are fictional. */
export const content: ExampleContent = {
    en: () => ({
        description: "Example CV: DevOps engineer.",
        basics: {
            name: "John Doe",
            headline: "DevOps Engineer — Kubernetes, Terraform, CI/CD",
            email: "john.doe@example.com",
            phone: "+387 61 000 005",
            location: "Mostar, Bosnia and Herzegovina (open to relocation)",
            summary:
                "DevOps engineer with five years of experience running Kubernetes platforms and automated delivery "
                + "pipelines. I turn manual releases into repeatable ones, keep infrastructure in code and watch the "
                + "numbers that matter: deploy frequency, recovery time and cost. Looking for a platform team in the DACH region.",
        },
        experience: [
            {
                id: "exp-1",
                company: "Cloudrail Systems",
                position: "DevOps Engineer",
                start: "2023-01",
                end: "Present",
                location: "Remote",
                highlights: [
                    "Moved 30 services to Kubernetes with Terraform and Helm; releases went from monthly to several per day.",
                    "Cut cloud spend by 22% through right-sizing and scheduled shutdown of test environments.",
                    "Built on-call dashboards and alerts; mean time to recovery fell from 70 to 18 minutes.",
                ],
                skills: ["Kubernetes", "Terraform", "AWS", "Prometheus"],
            },
            {
                id: "exp-2",
                company: "Datacore Hosting",
                position: "Systems Administrator",
                start: "2020-05",
                end: "2022-12",
                location: "Mostar",
                highlights: [
                    "Automated server setup with Ansible, replacing a 40-step manual checklist.",
                    "Introduced nightly backup restores to prove that backups actually work.",
                ],
                skills: ["Linux", "Ansible", "Bash", "GitLab CI"],
            },
        ],
        education: [
            {
                id: "edu-1",
                institution: "University of Mostar, Faculty of Mechanical Engineering, Computing and Electrical Engineering",
                area: "Computer Engineering",
                studyType: "BSc",
                start: "2016-10",
                end: "2020-07",
                location: "Mostar",
            },
        ],
        skillGroups: [
            {
                id: "group-main",
                name: "",
                skills: [
                    { id: "skill-1", name: "Kubernetes", level: "expert" },
                    { id: "skill-2", name: "Terraform", level: "expert" },
                    { id: "skill-3", name: "CI/CD pipelines", level: "expert" },
                    { id: "skill-4", name: "AWS", level: "proficient" },
                    { id: "skill-5", name: "Monitoring (Prometheus, Grafana)", level: "proficient" },
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
                cefr: { listening: "C1", reading: "C2", spokenInteraction: "C1", spokenProduction: "B2", writing: "C1" },
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
    de: () => ({
        description: "Beispiel-Lebenslauf: DevOps-Engineer.",
        basics: {
            name: "John Doe",
            headline: "DevOps-Engineer — Kubernetes, Terraform, CI/CD",
            email: "john.doe@example.com",
            phone: "+387 61 000 005",
            location: "Mostar, Bosnien und Herzegowina (Umzug möglich)",
            summary:
                "DevOps-Engineer mit fünf Jahren Erfahrung im Betrieb von Kubernetes-Plattformen und automatisierten "
                + "Auslieferungspfaden. Ich mache aus manuellen Releases wiederholbare, halte die Infrastruktur als Code und "
                + "beobachte die Kennzahlen, die zählen: Deployment-Häufigkeit, Wiederherstellungszeit und Kosten. Ich suche ein Plattformteam im DACH-Raum.",
        },
        experience: [
            {
                id: "exp-1",
                company: "Cloudrail Systems",
                position: "DevOps-Engineer",
                start: "2023-01",
                end: "Present",
                location: "Remote",
                highlights: [
                    "Umzug von 30 Diensten auf Kubernetes mit Terraform und Helm; Releases wechselten von monatlich auf mehrmals täglich.",
                    "Cloud-Kosten um 22 % gesenkt, durch angepasste Dimensionierung und zeitgesteuertes Abschalten von Testumgebungen.",
                    "Aufbau von Dashboards und Alarmen für die Rufbereitschaft; die mittlere Wiederherstellungszeit sank von 70 auf 18 Minuten.",
                ],
                skills: ["Kubernetes", "Terraform", "AWS", "Prometheus"],
            },
            {
                id: "exp-2",
                company: "Datacore Hosting",
                position: "Systemadministrator",
                start: "2020-05",
                end: "2022-12",
                location: "Mostar",
                highlights: [
                    "Automatisierung der Servereinrichtung mit Ansible anstelle einer manuellen Checkliste mit 40 Schritten.",
                    "Einführung nächtlicher Test-Wiederherstellungen, um zu belegen, dass Backups wirklich funktionieren.",
                ],
                skills: ["Linux", "Ansible", "Bash", "GitLab CI"],
            },
        ],
        education: [
            {
                id: "edu-1",
                institution: "Universität Mostar, Fakultät für Maschinenbau, Informatik und Elektrotechnik",
                area: "Computertechnik",
                studyType: "Bachelor of Science",
                start: "2016-10",
                end: "2020-07",
                location: "Mostar",
            },
        ],
        skillGroups: [
            {
                id: "group-main",
                name: "",
                skills: [
                    { id: "skill-1", name: "Kubernetes", level: "expert" },
                    { id: "skill-2", name: "Terraform", level: "expert" },
                    { id: "skill-3", name: "CI/CD-Pipelines", level: "expert" },
                    { id: "skill-4", name: "AWS", level: "proficient" },
                    { id: "skill-5", name: "Monitoring (Prometheus, Grafana)", level: "proficient" },
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
                cefr: { listening: "C1", reading: "C2", spokenInteraction: "C1", spokenProduction: "B2", writing: "C1" },
            },
            {
                id: "lang-3",
                language: "Deutsch",
                fluency: "B1",
                cefrDetailed: true,
                cefr: { listening: "B1", reading: "B2", spokenInteraction: "B1", spokenProduction: "B1", writing: "A2" },
            },
        ],
    }),
};

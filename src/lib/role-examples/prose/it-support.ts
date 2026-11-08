import type { RoleExampleLocale, RoleProse } from "../registry";

export const prose: Partial<Record<RoleExampleLocale, RoleProse>> = {
    en: {
        intro:
            "This example shows an IT support specialist with four years of experience who supports 300 employees and is applying for a helpdesk or service desk role in Germany, Austria or Switzerland. "
            + "The CV is one page: a short profile, two roles with concrete numbers, a skills list and a German level at B1 with a certificate. "
            + "Use it as a model and replace every detail with your own. Service desk managers often hire for patience, reliability and clear communication as much as for technical skill.",
        tips: [
            "Use support numbers a team lead understands: tickets per week, first-contact resolution rate and number of users or devices. These figures show the size of your work and let a reader compare you with their own team.",
            "Show what you fixed for good, not only what you closed. Writing how-to articles that reduce repeat tickets, or scripting a device setup, proves that you remove the cause and not just the symptom.",
            "Name the systems you administer: Microsoft 365, Active Directory, Windows and macOS, printers, VPN and ticketing tools. Some employers and tracking systems filter applications by these names, so use the exact product names that appear in the job advert.",
            "Describe how you work with users who are not technical. A short line about patience, plain language and documentation tells a hiring manager what your colleagues will experience when you take their call.",
            "State your German level with its certificate and mention that you can support in English too. Helpdesk work is spoken work, so a clear B1 or higher and a plan to improve it can count for a lot in DACH companies.",
        ],
        skills: [
            "Microsoft 365 administration",
            "Active Directory",
            "Windows and macOS support",
            "Networking basics (TCP/IP, DHCP, DNS)",
            "Ticket systems (Jira Service Management)",
            "Hardware repair and setup",
            "Remote support tools",
            "Scripting for device setup",
            "User training and documentation",
            "Customer-friendly communication",
        ],
        sections: [
            {
                heading: "Numbers a service desk lead recognises",
                paragraphs: [
                    "The Pannonia role gives a service desk lead the figures they use themselves: tickets per week, first-contact fix rate and the size of the user base. They allow a quick comparison with the reader's own team, which is why they work better than words such as reliable or customer-focused.",
                    "Two lines go beyond closing tickets. The scripted rollout to 300 laptops, at 20 minutes a device, shows the candidate can repeat a process at scale. The 35 how-to articles that cut repeat password and VPN tickets by a third show someone who removes the cause of a problem instead of answering it again. If you have done anything like that, it deserves a line of its own.",
                ],
            },
            {
                heading: "Early-career and non-degree paths",
                paragraphs: [
                    "This candidate holds a secondary school diploma in computer technology rather than a university degree, and the CV neither hides that nor dwells on it. The education entry is short and accurate, and the experience carries the weight. For support roles that is often a sound approach, since practical work with real users can count for as much as the qualification. List any vendor certificates you hold with the provider and year, so they can be checked.",
                    "The earlier technician role shows how practical work becomes relevant experience. Repairing hardware for households and securing small office networks with backups are real responsibilities, and the example describes them that way, not as odd jobs. If your background is mixed, say what the work was and what you were responsible for.",
                ],
            },
            {
                heading: "Mistakes in support CVs",
                paragraphs: [
                    "A classic mistake is a skills list that mixes computer literacy with troubleshooting. Phrases that broad mean very little. Name the products you actually support, as the example does with Microsoft 365, Active Directory, Windows 11 and Jira Service Management, and keep the soft skills for sentences where you can show them.",
                    "Many candidates also leave out how they handle people. Support work is a conversation, often with someone under stress, so one concrete line helps: how you explain a fix to a colleague who is not technical, or how you document it afterwards. Excellent communication skills on its own proves nothing.",
                    "Because support is spoken work, be exact about your language levels. If your German is B1, say B1, and say what that lets you handle, such as phone calls in German or written tickets only.",
                ],
            },
        ],
    },
    de: {
        intro:
            "Dieses Muster zeigt einen IT-Support-Mitarbeiter mit vier Jahren Erfahrung, der 300 Beschäftigte betreut und sich auf eine Stelle im Helpdesk oder Service Desk in Deutschland, Österreich oder der Schweiz bewirbt. "
            + "Der Lebenslauf umfasst eine Seite: kurzes Profil, zwei Stationen mit konkreten Zahlen, eine Skill-Liste und ein Deutschniveau B1 mit Zertifikat. "
            + "Nutzen Sie es als Vorbild und ersetzen Sie jede Angabe durch Ihre eigene. Leitungen im Service Desk stellen ebenso nach Geduld, Zuverlässigkeit und klarer Kommunikation ein wie nach technischem Können.",
        tips: [
            "Verwenden Sie Support-Zahlen, die eine Teamleitung versteht: Tickets pro Woche, Erstlösungsquote und Zahl der Nutzer oder Geräte. Diese Angaben zeigen den Umfang Ihrer Arbeit und lassen den Leser Sie mit dem eigenen Team vergleichen.",
            "Zeigen Sie, was Sie dauerhaft behoben haben, nicht nur, was Sie geschlossen haben. Anleitungen, die wiederkehrende Tickets senken, oder ein Skript für die Geräteeinrichtung belegen, dass Sie die Ursache beseitigen und nicht nur das Symptom.",
            "Nennen Sie die Systeme, die Sie betreuen: Microsoft 365, Active Directory, Windows und macOS, Drucker, VPN und Ticketsysteme. Arbeitgeber filtern Bewerbungen nach diesen Namen, verwenden Sie also die genauen Produktnamen aus der Stellenanzeige.",
            "Beschreiben Sie, wie Sie mit nicht technischen Nutzern arbeiten. Eine kurze Zeile über Geduld, einfache Sprache und Dokumentation sagt einer Führungskraft, was Kolleginnen und Kollegen erleben, wenn sie Ihren Anruf entgegennehmen.",
            "Geben Sie Ihr Deutschniveau mit Zertifikat an und erwähnen Sie, dass Sie auch auf Englisch unterstützen können. Helpdesk-Arbeit ist gesprochene Arbeit, deshalb zählen ein klares B1 oder mehr und ein Plan zur Verbesserung in Unternehmen im DACH-Raum viel.",
        ],
        skills: [
            "Microsoft-365-Administration",
            "Active Directory",
            "Windows- und macOS-Support",
            "Netzwerkgrundlagen (TCP/IP, DHCP, DNS)",
            "Ticketsysteme (Jira Service Management)",
            "Hardware-Reparatur und -Einrichtung",
            "Fernwartungswerkzeuge",
            "Skripte für die Geräteeinrichtung",
            "Nutzerschulung und Dokumentation",
            "Kundenfreundliche Kommunikation",
        ],
    },
};

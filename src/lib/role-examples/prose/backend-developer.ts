import type { RoleExampleLocale, RoleProse } from "../registry";

export const prose: Partial<Record<RoleExampleLocale, RoleProse>> = {
    en: {
        intro:
            "This example shows a backend developer with six years of Java experience in banking and insurance who is applying to a backend team in Germany, Austria or Switzerland. "
            + "It keeps to one page: a short profile, two roles with measurable results, a focused skills list and a German level stated with its certificate. "
            + "Use it as a model for structure and tone, and replace every fact with your own. Backend hiring managers often read for scale, reliability and ownership.",
        tips: [
            "Describe systems by their size and constraints. Numbers such as requests per second, data volume, number of integrations or deployment time help a reader place your experience, even when the company name is unknown to them.",
            "Show reliability work as well as features. Reducing a query from eleven seconds to under one, or raising test coverage on core modules, tells an employer that you care about how software behaves in production.",
            "Name your role in decisions. Phrases such as \"designed\", \"split\" or \"introduced\" show ownership, while \"was involved in\" hides it. Be precise, because interviewers may ask you to explain the design, perhaps on a whiteboard.",
            "Mention mentoring and code review if you do them. Many teams value people who raise the level of the whole team, and a short line about guiding junior developers is easy to add and easy to prove.",
            "Put your German level next to your work experience in a way that is checkable. B1 with a named certificate and a clear plan toward B2 is more convincing than \"good German\", and many employers want to see progress.",
        ],
        skills: [
            "Java",
            "Spring Boot",
            "PostgreSQL",
            "Apache Kafka",
            "REST API design",
            "Docker",
            "CI/CD with Jenkins",
            "Unit and integration testing",
            "Database performance tuning",
            "Code review and mentoring",
        ],
        sections: [
            {
                heading: "Reading this CV as a backend lead would",
                paragraphs: [
                    "The page answers the questions a backend lead asks first: how big were the systems, who depended on them, and what did this person own. A payment module split into three services, a report query cut from eleven seconds to under one, and APIs used by 150 broker offices each give a size or a consequence, so the reader can picture the scale without knowing the employers.",
                    "Notice that the results come as before and after. Deployment time fell from 90 to 15 minutes, and test coverage rose from 31% to 78%. A pair like that is more believable than one large figure, because it shows where the work started and invites a question about how it was done.",
                ],
            },
            {
                heading: "Stating ownership honestly",
                paragraphs: [
                    "Backend interviews often turn into design conversations, so the verbs on the page matter. The example says the candidate split the module, cut the query and mentors two developers, which are things one person can explain step by step. Use the verb that matches your part: designed, built, migrated, reviewed, maintained. If a result came from a team effort, name the team and your share of it.",
                    "Describe the system and its constraint first, then your change. A payment module that had to stay available while it was split is a more interesting story than the word services. If you could not explain why you chose a design over its alternatives, do not put that design on the CV.",
                ],
            },
            {
                heading: "Where backend CVs lose readers",
                paragraphs: [
                    "Backend work is invisible by nature, so candidates reach for scalable, robust and enterprise-grade. Those words use up space and prove nothing. Replace each one with the fact behind it: the number of integrations, the data volume, the availability you had to keep, or the incident you prevented.",
                    "Another habit is naming every framework, database and cloud provider you have ever touched. A long career can read as shallow that way. Keep the core stack in the headline, put supporting tools inside the role where you used them, and be ready to be asked about any of them.",
                    "Regulated sectors such as banking and insurance bring their own expectations of stability, traceability and careful change handling. If you worked under audit or compliance rules, one line saying so is useful to employers in the same field, but state only the rules you actually worked under.",
                ],
            },
        ],
    },
    de: {
        intro:
            "Dieses Muster zeigt einen Backend-Entwickler mit sechs Jahren Java-Erfahrung bei Banken und Versicherungen, der sich bei einem Backend-Team in Deutschland, Österreich oder der Schweiz bewirbt. "
            + "Es bleibt bei einer Seite: kurzes Profil, zwei Stationen mit messbaren Ergebnissen, eine fokussierte Skill-Liste und ein Deutschniveau mit Zertifikat. "
            + "Nutzen Sie es als Vorbild für Aufbau und Ton und ersetzen Sie jede Angabe durch Ihre eigene. Wer Backend-Stellen besetzt, liest auf Größenordnung, Zuverlässigkeit und Verantwortung.",
        tips: [
            "Beschreiben Sie Systeme über ihre Größe und ihre Randbedingungen. Zahlen wie Anfragen pro Sekunde, Datenvolumen, Zahl der Anbindungen oder Dauer der Bereitstellung helfen beim Einordnen, auch wenn der Firmenname dem Leser nichts sagt.",
            "Zeigen Sie auch Zuverlässigkeitsarbeit, nicht nur Funktionen. Eine Abfrage von elf Sekunden auf unter eine zu bringen oder die Testabdeckung der Kernmodule zu erhöhen, sagt einem Arbeitgeber, dass Sie auf das Verhalten im Betrieb achten.",
            "Benennen Sie Ihre Rolle bei Entscheidungen. Formulierungen wie „entworfen“, „aufgeteilt“ oder „eingeführt“ zeigen Verantwortung, „war beteiligt an“ verbirgt sie. Seien Sie genau, denn im Gespräch sollen Sie den Entwurf an der Tafel erklären.",
            "Erwähnen Sie Mentoring und Code-Reviews, wenn Sie sie machen. Deutsche Teams schätzen Menschen, die das Niveau des ganzen Teams heben, und eine kurze Zeile über die Begleitung von Nachwuchsentwicklern ist leicht ergänzt und leicht belegt.",
            "Stellen Sie Ihr Deutschniveau überprüfbar dar. B1 mit genanntem Zertifikat und einem klaren Plan Richtung B2 überzeugt mehr als „gute Deutschkenntnisse“, und viele Arbeitgeber möchten Fortschritt sehen.",
        ],
        skills: [
            "Java",
            "Spring Boot",
            "PostgreSQL",
            "Apache Kafka",
            "REST-API-Design",
            "Docker",
            "CI/CD mit Jenkins",
            "Unit- und Integrationstests",
            "Datenbank-Performance-Tuning",
            "Code-Review und Mentoring",
        ],
    },
};

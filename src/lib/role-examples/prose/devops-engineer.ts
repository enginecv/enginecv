import type { RoleExampleLocale, RoleProse } from "../registry";

export const prose: Partial<Record<RoleExampleLocale, RoleProse>> = {
    en: {
        intro:
            "This example shows a DevOps engineer with five years of experience in Kubernetes, infrastructure as code and delivery pipelines who wants to join a platform team in the DACH region. "
            + "The CV is one page: a short profile, two roles written around outcomes, a skills list ordered by depth and clear language levels. "
            + "Use the structure and replace every detail with your own. DevOps hiring managers often want proof that you improve speed, stability and cost, not only that you know the tools.",
        tips: [
            "Report the four delivery metrics where you can: how often you deploy, how long a change takes to reach production, how often releases fail and how fast you recover. Even rough before and after numbers make your work comparable.",
            "Include cost as well as speed. Cutting cloud spend by a fifth through right-sizing is a result that finance and engineering managers both understand, and it shows that you think about the business, not only about clusters.",
            "Say what you automated and what it replaced. \"Automated server setup, replacing a 40-step manual checklist\" is concrete, while \"worked with Ansible\" is not, and it gives the interviewer a story to ask about.",
            "Mention on-call, monitoring and incident work honestly. Teams hiring for operations often want to know you can stay calm in an outage, so one line about dashboards, alerts or a recovery you led is worth more than a long tool list.",
            "List certifications only if you hold them, and name the provider and year. AWS, Kubernetes or HashiCorp certificates are easy to verify, and an unverifiable claim in a technical CV can cost you trust.",
        ],
        skills: [
            "Kubernetes",
            "Terraform",
            "CI/CD pipelines",
            "AWS",
            "Linux administration",
            "Ansible",
            "Monitoring (Prometheus, Grafana)",
            "Scripting (Bash, Python)",
            "Incident response",
            "Cost optimisation",
        ],
        sections: [
            {
                heading: "Metrics a platform team can compare",
                paragraphs: [
                    "The three results in the Cloudrail role map onto numbers that platform teams track: how often releases ship, how quickly service is restored, and what the infrastructure costs. Moving from monthly releases to several a day and cutting recovery from 70 to 18 minutes are both before-and-after pairs, so a reader can judge the size of the change without knowing the company.",
                    "The Datacore role tells a quieter story. Replacing a 40-step checklist with automation, and restoring backups every night to prove they work, show habits rather than headline numbers. Early infrastructure work often looks like this, and these lines tell a reader the candidate checks that things actually work, not only that they are configured.",
                ],
            },
            {
                heading: "Tools are evidence only next to an outcome",
                paragraphs: [
                    "Tool names do a job in a DevOps CV, because advertisements are written in them, but they mean most beside what you did. Terraform on a skills list is a claim. Moved 30 services to Kubernetes with Terraform and Helm is evidence. Keep the tool next to the outcome wherever you can, and keep any separate list for the few you would be comfortable debugging live.",
                    "Be careful with cloud and certification claims. Say which services you operated yourself and which another team owned, and whether the environment was production or a lab. If you hold a certification, name the provider and year so it can be checked. If you are working toward one, say that instead.",
                ],
            },
            {
                heading: "Mistakes in infrastructure CVs",
                paragraphs: [
                    "The first mistake is describing operations only as tickets and tools. Incidents, on-call rotations and recoveries are some of the strongest evidence you can offer, and many candidates leave them out because they feel like failures. A calm, factual line about an outage you helped resolve, and what changed afterwards, reads as a strength.",
                    "The second is overstating scope. Teams reading infrastructure CVs often know the difference between running a platform and having set one up once, and an interview tends to test it. State the size honestly: the number of services, the number of environments, the size of the team.",
                    "The third is forgetting that platform engineers serve other developers. A line about documentation, internal tooling that colleagues adopted, or supporting developers through a migration shows that the work was used by someone.",
                ],
            },
        ],
    },
    de: {
        intro:
            "Dieses Muster zeigt einen DevOps-Engineer mit fünf Jahren Erfahrung in Kubernetes, Infrastructure as Code und Auslieferungspfaden, der zu einem Plattformteam im DACH-Raum wechseln möchte. "
            + "Der Lebenslauf umfasst eine Seite: kurzes Profil, zwei an Ergebnissen ausgerichtete Stationen, eine nach Kenntnistiefe sortierte Skill-Liste und klare Sprachniveaus. "
            + "Übernehmen Sie den Aufbau und ersetzen Sie jede Angabe durch Ihre eigene. Wer DevOps-Stellen besetzt, will den Beleg, dass Sie Geschwindigkeit, Stabilität und Kosten verbessern, nicht nur, dass Sie die Werkzeuge kennen.",
        tips: [
            "Nennen Sie, wo möglich, die vier Auslieferungskennzahlen: wie oft Sie deployen, wie lange eine Änderung bis in die Produktion braucht, wie oft Releases scheitern und wie schnell Sie sich erholen. Schon grobe Vorher-nachher-Zahlen machen Ihre Arbeit vergleichbar.",
            "Berücksichtigen Sie Kosten neben Geschwindigkeit. Die Cloud-Ausgaben durch angepasste Dimensionierung um ein Fünftel zu senken, versteht sowohl das Controlling als auch die technische Leitung, und es zeigt, dass Sie ans Geschäft denken, nicht nur an Cluster.",
            "Sagen Sie, was Sie automatisiert haben und was es ersetzt hat. „Servereinrichtung automatisiert, statt einer manuellen Checkliste mit 40 Schritten“ ist konkret, „Arbeit mit Ansible“ ist es nicht, und die Aussage gibt dem Gegenüber eine Geschichte zum Nachfragen.",
            "Erwähnen Sie Rufbereitschaft, Monitoring und Störungsarbeit ehrlich. Teams im Betrieb wollen wissen, dass Sie bei einem Ausfall ruhig bleiben; eine Zeile über Dashboards, Alarme oder eine von Ihnen geleitete Wiederherstellung wiegt mehr als eine lange Werkzeugliste.",
            "Nennen Sie Zertifizierungen nur, wenn Sie sie besitzen, mit Anbieter und Jahr. AWS-, Kubernetes- oder HashiCorp-Zertifikate lassen sich leicht prüfen, und eine nicht überprüfbare Angabe in einem technischen Lebenslauf kostet Vertrauen.",
        ],
        skills: [
            "Kubernetes",
            "Terraform",
            "CI/CD-Pipelines",
            "AWS",
            "Linux-Administration",
            "Ansible",
            "Monitoring (Prometheus, Grafana)",
            "Skripting (Bash, Python)",
            "Störungsmanagement",
            "Kostenoptimierung",
        ],
    },
};

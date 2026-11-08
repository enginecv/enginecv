import type { RoleExampleLocale, RoleProse } from "../registry";

export const prose: Partial<Record<RoleExampleLocale, RoleProse>> = {
    en: {
        intro:
            "This example shows a data analyst with four years of experience in retail and market research who is applying to an analytics team in Germany, Austria or Switzerland. "
            + "The CV is one page: a short profile, two roles written around decisions the analysis made possible, a skills list and a German level at B2 backed by an exam. "
            + "Use it as a model and replace every detail with your own. Analytics managers often read for business impact, clean method and clear communication.",
        tips: [
            "Start every bullet with the decision your analysis changed, then add the method. \"Found a stock-planning gap that cut write-offs by 12%\" shows value, while \"analysed stock data\" only shows activity.",
            "Quantify the time you saved as well as the money. Replacing manual reports with dashboards and stating the hours saved per week is easy to verify and shows that you improve how the team works.",
            "Be specific about your tools and what you did with them. Writing SQL joins and window functions, building a data model in Power BI or cleaning data with pandas are different skills, and job advertisements often name them separately.",
            "Show that you can explain results to non-specialists. A line about presenting findings to management in plain language can matter in companies where analysts work directly with department heads.",
            "Add a small portfolio link if you can: a dashboard with public data, a notebook on GitHub or a case study. Keep it tidy and explain the question, the data and the answer, because that is what an interviewer is likely to ask about.",
        ],
        skills: [
            "SQL",
            "Power BI",
            "Python (pandas)",
            "Excel (advanced)",
            "Data cleaning and modelling",
            "Statistics",
            "Dashboard design",
            "Report automation",
            "Presenting to management",
            "Business understanding of retail",
        ],
        sections: [
            {
                heading: "Decisions first, method second",
                paragraphs: [
                    "The strongest line on this CV is the stock-planning finding: a gap in planning that cut write-offs by 12% across 60 stores. It leads with the decision the analysis changed and lets the reader infer the method. The weaker alternative, analysed stock data, describes activity and leaves the reader to guess at the value. Look through your own bullets and move the outcome to the front.",
                    "The first Retailmax line works for a different reason. Fourteen manual reports replaced by dashboards, saving about 25 hours a week, is a result in time. It is easy to check and does not depend on quoting a financial figure you may not be free to share. Time saved is a useful number when the impact of your analysis was real but not yours to put a price on.",
                ],
            },
            {
                heading: "Showing method without a methods lecture",
                paragraphs: [
                    "Analytics managers want to know you can do the work correctly, but a CV is no place to explain it. The example names tools at the level they were used: SQL for the data work, pandas for cleaning and merging 5,000 survey responses, Power BI for the dashboards. If you used window functions, a statistical test or a data model you designed, say so in the bullet where you used it, because reviewers often look for those specifics.",
                    "Be careful with the word statistics. Statistical analysis can mean a correlation in a spreadsheet or a designed experiment, and an interviewer may ask which. Name the technique you used, or leave the claim out.",
                ],
            },
            {
                heading: "What weakens an analyst's CV",
                paragraphs: [
                    "Dashboards without decisions are the most common weakness. A list of reports and dashboards built shows output, not use. Say who used each one, how often, and what they decided differently because of it. A dashboard that was built and ignored is better left off the page.",
                    "Another weakness is hiding the data itself. A reader wants a rough sense of its size, its mess and its source: 5,000 survey responses, 60 stores, a weekly report. Remember too that this is a communication job as much as a technical one, so a line about presenting to non-specialists, as the example does for the management board, belongs on the page.",
                    "If you add a portfolio, choose one case where the question, the data and the answer are all easy to follow. Check that anything public contains only data you are allowed to share, and nothing from an employer or a client.",
                ],
            },
        ],
    },
    de: {
        intro:
            "Dieses Muster zeigt eine Datenanalystin mit vier Jahren Erfahrung in Handel und Marktforschung, die sich bei einem Analytics-Team in Deutschland, Österreich oder der Schweiz bewirbt. "
            + "Der Lebenslauf umfasst eine Seite: kurzes Profil, zwei Stationen, die sich an den durch die Analyse möglichen Entscheidungen orientieren, eine Skill-Liste und ein durch eine Prüfung belegtes Deutschniveau B2. "
            + "Nutzen Sie es als Vorbild und ersetzen Sie jede Angabe durch Ihre eigene. Führungskräfte im Analytics lesen auf geschäftliche Wirkung, saubere Methode und klare Kommunikation.",
        tips: [
            "Beginnen Sie jeden Punkt mit der Entscheidung, die Ihre Analyse verändert hat, und nennen Sie danach die Methode. „Lücke in der Bestandsplanung gefunden, die Abschreibungen um 12 % senkte“ zeigt Wert, „Bestandsdaten analysiert“ zeigt nur Tätigkeit.",
            "Beziffern Sie neben dem Geld auch die gesparte Zeit. Manuelle Berichte durch Dashboards zu ersetzen und die Stunden pro Woche zu nennen, ist leicht prüfbar und zeigt, dass Sie die Arbeitsweise des Teams verbessern.",
            "Seien Sie bei den Werkzeugen genau und sagen Sie, was Sie damit getan haben. SQL-Joins und Fensterfunktionen schreiben, ein Datenmodell in Power BI aufbauen oder Daten mit pandas bereinigen sind verschiedene Fähigkeiten, nach denen Recruiter getrennt suchen.",
            "Zeigen Sie, dass Sie Ergebnisse Nicht-Fachleuten erklären können. Eine Zeile über die verständliche Präsentation vor der Geschäftsleitung zählt in deutschen Unternehmen, in denen Analysten oft direkt mit Abteilungsleitungen arbeiten.",
            "Fügen Sie, wenn möglich, einen kleinen Portfolio-Link hinzu: ein Dashboard mit öffentlichen Daten, ein Notebook auf GitHub oder eine Fallstudie. Halten Sie es aufgeräumt und erklären Sie Frage, Daten und Antwort, denn genau danach fragt das Gegenüber im Gespräch.",
        ],
        skills: [
            "SQL",
            "Power BI",
            "Python (pandas)",
            "Excel (fortgeschritten)",
            "Datenbereinigung und Datenmodellierung",
            "Statistik",
            "Dashboard-Gestaltung",
            "Berichtsautomatisierung",
            "Präsentation vor der Geschäftsleitung",
            "Geschäftsverständnis im Handel",
        ],
    },
};

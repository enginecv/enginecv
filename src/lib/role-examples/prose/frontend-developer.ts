import type { RoleExampleLocale, RoleProse } from "../registry";

export const prose: Partial<Record<RoleExampleLocale, RoleProse>> = {
    en: {
        intro:
            "This example shows a frontend developer with four years of experience who builds accessible, fast interfaces and is ready to move to a product team in the DACH region. "
            + "The CV is one page of plain text with a short profile, two roles written around results, a tight skills list and honest language levels. "
            + "Use the structure, then replace every detail with your own work. Hiring teams for frontend roles often look for evidence of shipped interfaces, not a list of frameworks.",
        tips: [
            "Show impact on users and the business, not just the framework. \"Completed orders rose by 9% after the checkout rebuild\" is stronger than \"worked with React\", because it ties your code to a result a manager cares about.",
            "Mention accessibility and performance explicitly. Some employers in Germany now have legal accessibility duties, so words like WCAG, keyboard support and Lighthouse scores signal that you already think about them.",
            "Link a live project, a component library or your GitHub profile, and check that the links work on a phone. A reviewer who can click and see your interface in ten seconds can learn more than from three paragraphs.",
            "Name the tools around the code: design handoff in Figma, component testing, end-to-end tests and CI. Frontend work happens in a team, and these details show that you can work inside a delivery process.",
            "Keep the skills section honest and ordered. Put what you use daily first, and move anything you touched once to the experience entry where it belongs, because interviewers may test any item.",
        ],
        skills: [
            "React",
            "TypeScript",
            "HTML and CSS",
            "Web accessibility (WCAG)",
            "Component testing (Vitest)",
            "End-to-end testing (Playwright)",
            "Design handoff with Figma",
            "Performance optimisation",
            "Git and code review",
            "Cross-browser compatibility",
        ],
        sections: [
            {
                heading: "What a frontend hiring team reads in this CV",
                paragraphs: [
                    "The headline pairs the stack with accessibility, which tells a reader what kind of frontend developer this is before they open the first role. The experience then moves from agency work, where speed and polish matter, to a product company, where the same person looks after a checkout and a shared component library. That progression, from delivering sites to owning part of a product, is the story the page is built to tell.",
                    "Both roles name a result for users and a measurable engineering result. The checkout rebuild reports completed orders and bundle size together, so a product manager and an engineer each find a number they care about. Twelve sites above 90 in Lighthouse performance gives the agency years a standard to be judged against, not just a count of projects.",
                ],
            },
            {
                heading: "Claiming accessibility and performance without overclaiming",
                paragraphs: [
                    "Accessibility is easy to claim and hard to prove. The example ties it to something concrete: a component library with accessibility tests that four product teams use. If you have audited a page against WCAG, fixed keyboard traps or tested with a screen reader, say which and where. If you have not done that work yet, leave the word off and list what you are learning instead, because a reviewer who opens your linked project may well check.",
                    "Performance works the same way. A Lighthouse score depends on the device and network it was measured on, so state what you improved rather than only the score: a bundle that shrank, a page that loaded sooner, an interaction that stopped lagging. Name the tool you measured with, so that someone else could repeat the measurement.",
                ],
            },
            {
                heading: "Mistakes that weaken a frontend CV",
                paragraphs: [
                    "A framework list is not a portfolio. Naming React, Vue and Angular side by side says little unless you show what you built with each, and a long list can make a reader doubt the depth of all of it. Pick the stack you want to be hired for and attach it to the work you did with it.",
                    "A second mistake is a link that does not hold up: a live site that breaks on a phone, a repository with an empty README, or a design clone that never reached a real user. Open every link on your phone before you send the CV. The third is leaving out the people you work with. A line about working with designers, or handing off in Figma, shows that you ship as part of a team, which is what most product teams are hiring for.",
                ],
            },
        ],
    },
    de: {
        intro:
            "Dieses Muster zeigt eine Frontend-Entwicklerin mit vier Jahren Erfahrung, die barrierefreie, schnelle Oberflächen baut und zu einem Produktteam im DACH-Raum wechseln möchte. "
            + "Der Lebenslauf ist eine Seite klarer Text mit kurzem Profil, zwei an Ergebnissen ausgerichteten Stationen, einer knappen Skill-Liste und ehrlichen Sprachniveaus. "
            + "Übernehmen Sie den Aufbau und ersetzen Sie jede Angabe durch Ihre eigene Arbeit. Teams, die Frontend-Stellen besetzen, suchen Belege für ausgelieferte Oberflächen, keine Liste von Frameworks.",
        tips: [
            "Zeigen Sie die Wirkung für Nutzer und Unternehmen, nicht nur das Framework. „Abgeschlossene Bestellungen stiegen nach dem Checkout-Umbau um 9 %“ überzeugt mehr als „Arbeit mit React“, weil es Ihren Code mit einem Ergebnis verbindet, das eine Führungskraft interessiert.",
            "Nennen Sie Barrierefreiheit und Performance ausdrücklich. Arbeitgeber in Deutschland haben zunehmend rechtliche Pflichten zur Barrierefreiheit, deshalb signalisieren Begriffe wie WCAG, Tastaturbedienung und Lighthouse-Werte, dass Sie diese Themen schon mitdenken.",
            "Verlinken Sie ein laufendes Projekt, eine Komponentenbibliothek oder Ihr GitHub-Profil und prüfen Sie, dass die Links auch auf dem Smartphone funktionieren. Wer Ihre Oberfläche in zehn Sekunden anklicken kann, erfährt mehr als aus drei Absätzen.",
            "Nennen Sie die Werkzeuge rund um den Code: Design-Übergabe in Figma, Komponententests, End-to-End-Tests und CI. Frontend-Arbeit findet im Team statt, und diese Angaben zeigen, dass Sie in einem Auslieferungsprozess arbeiten können.",
            "Halten Sie den Skills-Abschnitt ehrlich und sortiert. Nennen Sie zuerst, was Sie täglich nutzen, und verschieben Sie alles, was Sie nur einmal berührt haben, in die passende Station, denn im Gespräch wird jeder Punkt geprüft.",
        ],
        skills: [
            "React",
            "TypeScript",
            "HTML und CSS",
            "Barrierefreiheit (WCAG)",
            "Komponententests (Vitest)",
            "End-to-End-Tests (Playwright)",
            "Design-Übergabe mit Figma",
            "Performance-Optimierung",
            "Git und Code-Review",
            "Browserübergreifende Kompatibilität",
        ],
    },
};

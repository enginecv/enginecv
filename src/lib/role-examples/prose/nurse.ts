import type { RoleExampleLocale, RoleProse } from "../registry";

export const prose: Partial<Record<RoleExampleLocale, RoleProse>> = {
    en: {
        intro:
            "This example shows a registered nurse from the Western Balkans with seven years of hospital experience, four of them in intensive care, "
            + "who is preparing to work in Germany. The layout is a classic German-style CV: reverse chronological, one clear page, a short profile on top "
            + "and the German level shown skill by skill. Use it as a model for structure and tone, and replace every detail with your own. "
            + "Never copy employers, dates or achievements that are not yours.",
        tips: [
            "Put your professional title and ward first. Hospitals in Germany often sort applications by department, so \"Registered Nurse, Intensive Care\" in the headline helps the right team find you quickly.",
            "Describe care in numbers a ward manager understands: patients per shift, bed count, equipment and procedures such as ventilation care, infusions or wound management. Specific scope shows your level better than general words like \"dedicated\".",
            "Show your German level with the CEFR scale and the exam behind it. Many employers ask for at least B2 for clinical work, and requirements differ by state and employer, so name the certificate, for example Goethe, telc or ÖSD, and say honestly where speaking or writing is still weaker.",
            "Mention that your qualification is being recognised. Nursing qualifications from outside the EU generally go through a recognition procedure in Germany, and a single line saying where you are in it tells the employer that you know the process.",
            "Add the extras that matter on a ward: life support courses, hygiene training, experience with documentation systems, shift work and teamwork with doctors and therapists. Leave out hobbies unless they relate to care.",
        ],
        skills: [
            "Intensive care nursing",
            "Ventilation care",
            "Medication management",
            "Wound care",
            "Basic and advanced life support",
            "Care documentation",
            "Hygiene standards",
            "Patient and family communication",
            "Shift work and teamwork",
            "German at B2 for clinical work",
        ],
        sections: [
            {
                heading: "How the example is built for a German hospital",
                paragraphs: [
                    "The structure is the classic German CV: reverse chronological, one page, with the profession and ward in the headline and the language level easy to find. The two hospital roles show a path from internal medicine to intensive care, with the scope given in numbers a ward manager reads at once: up to three ventilated patients per shift in a twelve-bed unit, eight to ten patients on the medical ward. Those details place the candidate's experience more precisely than any adjective could.",
                    "The handover checklist line shows initiative inside a team. Nursing is shift work, and an improvement that every shift now uses is the result of cooperation as much as of one person's effort. If you have introduced or improved something on your ward, even a small checklist or routine, it belongs on the page.",
                ],
            },
            {
                heading: "Recognition and language: say what is true",
                paragraphs: [
                    "Working as a nurse in Germany depends on recognition of your qualification and on proof of your German, and the rules differ by situation and by federal state. A qualification from outside the EU generally goes through a recognition procedure with the competent state authority, while qualifications from EU countries may follow a different route. Check the current requirements with the authority responsible for the state you are applying in, and describe your own status exactly: not started, applied, in progress, or recognised.",
                    "The same applies to language. The example states German at B2 and shows levels skill by skill, because hospitals often ask for a certificate at a specific level and may also want a profession-specific language test. Do not state a level you have not been assessed at, and name the exam if you have one. A dated certificate is stronger than a self-assessment.",
                ],
            },
            {
                heading: "What not to put on a nursing CV",
                paragraphs: [
                    "Do not write about patients in a way that could identify them. Describe the type of ward, the number of patients and the procedures, but never names, rare case details or anything taken from a real record. The example keeps to scope and routine for exactly that reason.",
                    "Avoid empty character words such as caring, dedicated and hard-working. Everyone in the profession would claim them, and the example shows them instead through the handover checklist, careful documentation and the shift pattern. Do not pad a short career either: two honest roles with specific scope read better than five vague ones.",
                    "Finally, ask a colleague who knows the German system to read the CV before you send it. Ward names and qualification titles have German equivalents, and a native reader will spot a translation that sounds odd.",
                ],
            },
        ],
    },
    de: {
        intro:
            "Dieses Muster zeigt eine Pflegefachkraft vom Westbalkan mit sieben Jahren Klinikerfahrung, davon vier auf der Intensivstation, die sich auf die Arbeit "
            + "in Deutschland vorbereitet. Der Aufbau entspricht einem klassischen deutschen Lebenslauf: antichronologisch, eine klare Seite, ein kurzes Profil "
            + "am Anfang und das Deutschniveau nach Fertigkeiten aufgeschlüsselt. Nutzen Sie es als Vorbild für Aufbau und Ton und ersetzen Sie jede Angabe durch "
            + "Ihre eigene. Übernehmen Sie niemals Arbeitgeber, Zeiträume oder Erfolge, die nicht Ihre sind.",
        tips: [
            "Stellen Sie Berufsbezeichnung und Fachbereich nach vorn. Kliniken in Deutschland sortieren Bewerbungen nach Fachgebiet, deshalb hilft „Gesundheits- und Krankenpflegerin, Intensivpflege“ in der Überschrift, die richtige Abteilung schnell zu erreichen.",
            "Beschreiben Sie Ihre Arbeit mit Zahlen, die eine Stationsleitung versteht: Patienten pro Schicht, Bettenzahl, Geräte und Maßnahmen wie Beatmungspflege, Infusionen oder Wundmanagement. Konkreter Umfang zeigt Ihr Niveau besser als allgemeine Worte wie „engagiert“.",
            "Belegen Sie Ihr Deutsch mit dem Referenzrahmen (GER) und der Prüfung dahinter. Für die klinische Arbeit wird meist mindestens B2 erwartet; nennen Sie das Zertifikat, zum Beispiel Goethe, telc oder ÖSD, und sagen Sie ehrlich, wo Sprechen oder Schreiben noch schwächer ist.",
            "Erwähnen Sie, dass Ihre Qualifikation anerkannt wird. Für Pflegeabschlüsse aus Drittstaaten ist in Deutschland ein Anerkennungsverfahren nötig, und eine Zeile, dass es läuft, zeigt dem Arbeitgeber, dass Sie den Ablauf kennen.",
            "Ergänzen Sie, was auf Station zählt: Reanimationskurse, Hygieneschulungen, Erfahrung mit Dokumentationssystemen, Schichtdienst und Zusammenarbeit mit Ärzten und Therapeuten. Hobbys lassen Sie weg, sofern sie nichts mit Pflege zu tun haben.",
        ],
        skills: [
            "Intensivpflege",
            "Pflege beatmeter Patienten",
            "Medikamentenmanagement",
            "Wundversorgung",
            "Basic und Advanced Life Support",
            "Pflegedokumentation",
            "Hygienestandards",
            "Kommunikation mit Patienten und Angehörigen",
            "Schichtdienst und Teamarbeit",
            "Deutsch auf B2 für die klinische Arbeit",
        ],
    },
};

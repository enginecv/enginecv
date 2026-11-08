import type { Locale } from "@/lib/i18n";

export type BlogTranslationKey =
    | "eyebrow"
    | "index.title"
    | "index.description"
    | "index.empty"
    | "index.moreEnglish"
    | "breadcrumb"
    | "author"
    | "readingTime"
    | "updated"
    | "sponsored"
    | "sponsoredDisclosure"
    | "readArticle"
    | "toc"
    | "tocNoHeadings"
    | "sidebar.sponsoredSpace"
    | "cta.eyebrow"
    | "cta.title"
    | "cta.description"
    | "cta.button"
    | "cta.note"
    | "ad.label"
    | "ad.description"
    | "ad.slotAfterFirst"
    | "ad.slotMidArticle"
    | "ad.slotEndArticle"
    | "ad.slotSidebar"
    | "draftNotice";

type BlogTranslations = Record<BlogTranslationKey, string>;

// Blog chrome copy. German uses "du" and Bosnian "vi", like the rest of the site.
const blogTranslations: Record<Locale, BlogTranslations> = {
    en: {
        "index.moreEnglish": "More posts in English",
        "index.empty": "There are no published articles in this language yet.",
        eyebrow: "EngineCV Blog",
        "index.title": "Practical resume advice, without the fluff",
        "index.description":
            "Guides, templates, and ATS-focused writing advice to help you land more interviews.",
        breadcrumb: "Blog",
        author: "Author",
        readingTime: "{minutes} min read",
        updated: "Updated {date}",
        sponsored: "Sponsored",
        sponsoredDisclosure:
            "This post is marked as sponsored. The page structure already supports future disclosure copy, partner placements, and sponsored calls to action without introducing a separate template.",
        readArticle: "Read article",
        toc: "On this page",
        tocNoHeadings: "No headings",
        "sidebar.sponsoredSpace": "Sponsored space",
        "cta.eyebrow": "EngineCV",
        "cta.title": "Build your resume in minutes",
        "cta.description":
            "Create and tailor resumes locally, keep your data on your device, and export when you are ready.",
        "cta.button": "Create your CV with EngineCV",
        "cta.note": "No account, no signup. Just open the builder.",
        "ad.label": "Monetization Placeholder",
        "ad.description":
            "Reserved ad slot {position}. This can later hold ads, affiliate modules, or sponsored callouts without changing article templates.",
        "ad.slotAfterFirst": "after the first paragraph",
        "ad.slotMidArticle": "mid-article",
        "ad.slotEndArticle": "at the end of the article",
        "ad.slotSidebar": "in the sidebar",
        draftNotice: "Draft under review: this translation isn't published yet and may still change.",
    },
    bs: {
        "index.moreEnglish": "Više članaka na engleskom",
        "index.empty": "Na ovom jeziku još nema objavljenih članaka.",
        eyebrow: "EngineCV Blog",
        "index.title": "Praktični savjeti za CV, bez prazne priče",
        "index.description":
            "Vodiči, predlošci i ATS savjeti za pisanje koji vam pomažu da dođete do više intervjua.",
        breadcrumb: "Blog",
        author: "Autor",
        readingTime: "{minutes} min čitanja",
        updated: "Ažurirano {date}",
        sponsored: "Sponzorisano",
        sponsoredDisclosure:
            "Ovaj članak je označen kao sponzorisan. Struktura stranice već podržava buduće napomene, partnerske pozicije i sponzorisane pozive na akciju bez uvođenja posebnog predloška.",
        readArticle: "Pročitajte članak",
        toc: "Na ovoj stranici",
        tocNoHeadings: "Nema naslova",
        "sidebar.sponsoredSpace": "Sponzorisani prostor",
        "cta.eyebrow": "EngineCV",
        "cta.title": "Napravite svoj CV za nekoliko minuta",
        "cta.description":
            "Kreirajte i prilagodite CV lokalno, zadržite podatke na svom uređaju i izvezite kada budete spremni.",
        "cta.button": "Kreirajte svoj CV uz EngineCV",
        "cta.note": "Nema naloga ni registracije. Otvori uređivač i počni.",
        "ad.label": "Mjesto za monetizaciju",
        "ad.description":
            "Rezervisano oglasno mjesto {position}. Kasnije ovdje mogu biti oglasi, partnerski moduli ili sponzorisani pozivi bez mijenjanja predloška članka.",
        "ad.slotAfterFirst": "nakon prvog pasusa",
        "ad.slotMidArticle": "na sredini članka",
        "ad.slotEndArticle": "na kraju članka",
        "ad.slotSidebar": "u bočnom panelu",
        draftNotice: "Nacrt u pregledu: ovaj prijevod još nije objavljen i može se još mijenjati.",
    },
    de: {
        "index.moreEnglish": "Weitere Artikel auf Englisch",
        "index.empty": "In dieser Sprache gibt es noch keine veröffentlichten Artikel.",
        eyebrow: "EngineCV Blog",
        "index.title": "Praktische Lebenslauf-Tipps, ohne leere Phrasen",
        "index.description":
            "Leitfäden, Vorlagen und ATS-taugliche Schreibtipps, die dir zu mehr Vorstellungsgesprächen verhelfen.",
        breadcrumb: "Blog",
        author: "Autor",
        readingTime: "{minutes} Min. Lesezeit",
        updated: "Aktualisiert am {date}",
        sponsored: "Gesponsert",
        sponsoredDisclosure:
            "Dieser Beitrag ist als gesponsert markiert. Die Seitenstruktur unterstützt bereits künftige Hinweise, Partnerplatzierungen und gesponserte Handlungsaufrufe, ohne eine separate Vorlage einzuführen.",
        readArticle: "Artikel lesen",
        toc: "Auf dieser Seite",
        tocNoHeadings: "Keine Überschriften",
        "sidebar.sponsoredSpace": "Gesponserter Bereich",
        "cta.eyebrow": "EngineCV",
        "cta.title": "Erstelle deinen Lebenslauf in wenigen Minuten",
        "cta.description":
            "Erstelle und passe Lebensläufe lokal an, behalte deine Daten auf deinem Gerät und exportiere, sobald du bereit bist.",
        "cta.button": "Lebenslauf mit EngineCV erstellen",
        "cta.note": "Für den Editor brauchst du kein Konto.",
        "ad.label": "Platzhalter für Monetarisierung",
        "ad.description":
            "Reservierter Anzeigenplatz {position}. Später können hier Anzeigen, Affiliate-Module oder gesponserte Hinweise erscheinen, ohne die Artikelvorlage zu ändern.",
        "ad.slotAfterFirst": "nach dem ersten Absatz",
        "ad.slotMidArticle": "in der Mitte des Artikels",
        "ad.slotEndArticle": "am Ende des Artikels",
        "ad.slotSidebar": "in der Seitenleiste",
        draftNotice: "Entwurf in Prüfung: Diese Übersetzung ist noch nicht veröffentlicht und kann sich noch ändern.",
    },
    fr: {
        "index.moreEnglish": "Plus d’articles en anglais",
        "index.empty": "Aucun article n’a encore été publié dans cette langue.",
        eyebrow: "Blog EngineCV",
        "index.title": "Des conseils CV pratiques, sans blabla",
        "index.description":
            "Guides, modèles et conseils de rédaction pensés pour les ATS, pour décrocher plus d'entretiens.",
        breadcrumb: "Blog",
        author: "Auteur",
        readingTime: "{minutes} min de lecture",
        updated: "Mis à jour le {date}",
        sponsored: "Sponsorisé",
        sponsoredDisclosure:
            "Cet article est signalé comme sponsorisé. La structure de la page prend déjà en charge de futures mentions, des placements partenaires et des appels à l'action sponsorisés sans introduire de modèle séparé.",
        readArticle: "Lire l'article",
        toc: "Sur cette page",
        tocNoHeadings: "Aucun titre",
        "sidebar.sponsoredSpace": "Espace sponsorisé",
        "cta.eyebrow": "EngineCV",
        "cta.title": "Créez votre CV en quelques minutes",
        "cta.description":
            "Créez et adaptez vos CV localement, gardez vos données sur votre appareil et exportez quand vous êtes prêt.",
        "cta.button": "Créer votre CV avec EngineCV",
        "cta.note": "Aucun compte n'est requis pour l'éditeur.",
        "ad.label": "Emplacement de monétisation",
        "ad.description":
            "Emplacement publicitaire réservé {position}. Il pourra plus tard accueillir des annonces, des modules d'affiliation ou des encarts sponsorisés sans modifier le modèle d'article.",
        "ad.slotAfterFirst": "après le premier paragraphe",
        "ad.slotMidArticle": "au milieu de l'article",
        "ad.slotEndArticle": "à la fin de l'article",
        "ad.slotSidebar": "dans la barre latérale",
        draftNotice: "Brouillon en relecture : cette traduction n'est pas encore publiée et peut encore changer.",
    },
    es: {
        "index.moreEnglish": "Más artículos en inglés",
        "index.empty": "Todavía no hay artículos publicados en este idioma.",
        eyebrow: "Blog de EngineCV",
        "index.title": "Consejos prácticos para tu currículum, sin relleno",
        "index.description":
            "Guías, plantillas y consejos de redacción pensados para ATS para conseguir más entrevistas.",
        breadcrumb: "Blog",
        author: "Autor",
        readingTime: "{minutes} min de lectura",
        updated: "Actualizado el {date}",
        sponsored: "Patrocinado",
        sponsoredDisclosure:
            "Esta publicación está marcada como patrocinada. La estructura de la página ya admite futuros avisos, ubicaciones de socios y llamadas a la acción patrocinadas sin introducir una plantilla aparte.",
        readArticle: "Leer artículo",
        toc: "En esta página",
        tocNoHeadings: "Sin encabezados",
        "sidebar.sponsoredSpace": "Espacio patrocinado",
        "cta.eyebrow": "EngineCV",
        "cta.title": "Crea tu currículum en minutos",
        "cta.description":
            "Crea y adapta currículums localmente, mantén tus datos en tu dispositivo y exporta cuando estés listo.",
        "cta.button": "Crea tu CV con EngineCV",
        "cta.note": "No necesitas cuenta para usar el editor.",
        "ad.label": "Espacio de monetización",
        "ad.description":
            "Espacio publicitario reservado {position}. Más adelante podrá albergar anuncios, módulos de afiliados o mensajes patrocinados sin cambiar la plantilla del artículo.",
        "ad.slotAfterFirst": "después del primer párrafo",
        "ad.slotMidArticle": "a mitad del artículo",
        "ad.slotEndArticle": "al final del artículo",
        "ad.slotSidebar": "en la barra lateral",
        draftNotice: "Borrador en revisión: esta traducción aún no está publicada y puede cambiar.",
    },
};

export function translateBlog(locale: Locale, key: BlogTranslationKey, params?: Record<string, string | number>) {
    let value = blogTranslations[locale]?.[key] || blogTranslations.en[key];

    if (params) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
            value = value.replace(`{${paramKey}}`, String(paramValue));
        }
    }

    return value;
}

/** Every chrome key per locale, for tests. */
export function blogTranslationEntries(): Array<[Locale, BlogTranslationKey, string]> {
    return Object.entries(blogTranslations).flatMap(([locale, entries]) =>
        Object.entries(entries).map(([key, value]) => [locale as Locale, key as BlogTranslationKey, value] as [Locale, BlogTranslationKey, string]));
}

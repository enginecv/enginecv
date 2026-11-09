import type { ExampleContent } from "./types";

export const content: ExampleContent = {
    en: () => ({
        description: "Example CV: sales and office coordinator.",
        basics: {
            name: "Jane Doe",
            headline: "Sales and Office Coordinator",
            email: "jane.doe@example.com",
            phone: "+387 65 000 003",
            location: "Banja Luka, Bosnia and Herzegovina",
            summary:
                "Organised office and sales coordinator with six years in wholesale and "
                + "distribution. I keep orders, customers and paperwork moving, and I like "
                + "turning messy processes into simple ones. Comfortable in German, English "
                + "and the languages of the region.",
        },
        experience: [
            {
                id: "exp-1",
                company: "Sava Trade d.o.o.",
                position: "Sales Coordinator",
                start: "2021-06",
                end: "Present",
                location: "Banja Luka",
                highlights: [
                    "Handle orders and deliveries for 120 business customers in Austria and Germany.",
                    "Moved customer records into a CRM and set up monthly reports for the sales team.",
                    "Reduced late invoices by 30% with a weekly follow-up routine.",
                ],
            },
            {
                id: "exp-2",
                company: "Office Plus",
                position: "Office Administrator",
                start: "2018-03",
                end: "2021-05",
                location: "Banja Luka",
                highlights: [
                    "Managed the front office, calendars and travel for a team of 25.",
                    "Prepared quotes, contracts and correspondence in German and English.",
                ],
            },
        ],
        education: [
            {
                id: "edu-1",
                institution: "University of Banja Luka, Faculty of Economics",
                area: "Business Administration",
                studyType: "BA",
                start: "2013-10",
                end: "2017-07",
                location: "Banja Luka",
            },
        ],
        skillGroups: [
            {
                id: "group-main",
                name: "",
                skills: [
                    { id: "skill-1", name: "Order processing", level: "expert" },
                    { id: "skill-2", name: "Customer care", level: "expert" },
                    { id: "skill-3", name: "CRM (HubSpot, Salesforce)", level: "proficient" },
                    { id: "skill-4", name: "Microsoft Excel and Word", level: "expert" },
                    { id: "skill-5", name: "Invoicing and bookkeeping basics", level: "proficient" },
                ],
            },
        ],
        languages: [
            { id: "lang-1", language: "Serbian", fluency: "Native" },
            {
                id: "lang-2",
                language: "German",
                fluency: "B2",
                cefrDetailed: true,
                cefr: { listening: "B2", reading: "B2", spokenInteraction: "B2", spokenProduction: "B1", writing: "B2" },
            },
            {
                id: "lang-3",
                language: "English",
                fluency: "C1",
                cefrDetailed: true,
                cefr: { listening: "C1", reading: "C1", spokenInteraction: "C1", spokenProduction: "B2", writing: "C1" },
            },
        ],
    }),
};

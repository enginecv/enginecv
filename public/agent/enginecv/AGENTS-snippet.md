## EngineCV resume file

The user's CV lives in a JSON file in the `enginecv.authoring/v1` format, in a workspace folder connected to https://enginecv.app. Ask for the file's path if you do not know it. Full guidance: https://enginecv.app/agent/enginecv/SKILL.md

The file holds the user's CV, including contact details. Treat it as private: never copy it to a place the user did not ask for, and tell the user that reading it may send its contents to your model provider.

Rules:

1. Edit only what the user asked for. Leave every other entry, field and section byte-for-byte as it is.
2. Keep the user's wording, dates and language. Never invent facts, employers, dates, numbers or skills.
3. Keep entry `id` values when you edit an entry. Leave `id` out for a new entry; the app assigns one.
4. Keep the file valid JSON (double quotes, no comments, no trailing commas).
5. Do not edit `design` or anything about looks. Design belongs to the app.
6. Make small targeted edits with your patch or string-replace tool, changing only the part you were asked about. Do not re-output or rewrite the whole file: a CV file can be tens of kilobytes, and rewriting it wastes tokens and risks changing things you did not mean to. To find a part, search for its key (for example `"projects"`) or an entry `id` instead of reading the whole file.
7. Keep the file's formatting (2-space indent, key order) so a change stays a small diff.
8. Every edit must leave the file valid JSON; put related changes (such as adding an entry and its comma) in one edit. If the file is briefly invalid between two edits, the app keeps the CV as it was and picks the result up once the file is valid again.
9. Do not rename or move the file. Its name is the name of the CV in the app.
10. If a request is unclear or would need information you do not have, ask the user first.

Format overview (schema: https://enginecv.app/schema/authoring/v1.json):

- format: "enginecv.authoring/v1" (required)
- design (optional hints): template, accent ("#rrggbb"), cvLanguage
- basics: name, headline, email, phone, location, website, linkedin, github, links, drivingLicense, nationality, dateOfBirth, passport, nationalId, maritalStatus, militaryService, genderPronoun, disability, visa, height
- summary: Markdown text
- experience[]: position, company, location, start, end, description, highlights, skills, url
- education[]: institution, studyType, area, location, start, end, score, description, courses, skills, url
- courses[]: name, institution, location, start, end, description, skills, url
- projects[]: name, subtitle, start, end, description, highlights, keywords, skills, url, repos, visibility
- organisations[]: name, role, location, start, end, description, skills, url
- certificates[]: name, issuer, date, description, skills, url, issuerUrl
- awards[]: name, issuer, date, description, skills, url
- publications[]: name, publisher, date, description, skills, url
- references[]: name, position, organisation, email, phone, description, url
- declaration: text, fullName, place, date
- skills: ["name", ...] or { "Group": ["name", { "name", "level" }] }; level: beginner, amateur, competent, proficient, expert
- languages: ["Language: level", ...]; level: A1–C2 or native
- interests: ["name", ...] or [{ name, description }]
- custom[]: { title, text } or { title, tags: [...] } or { title, entries: [{ title, subtitle, location, start, end, description, skills, url }] }

Out of scope (tell the user to use the app): Design, colours, fonts, templates and layout; The photo and the signature (they are never stored in the file); Exporting to PDF, Word or other formats.

After editing, check the part you changed. The app shows "Updated from file" or an error with a line and column.

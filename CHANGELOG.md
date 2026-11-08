# Changelog

All notable user-facing changes to EngineCV are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
with date-based sections.

## [Unreleased]

### Added
- CV examples (enginecv.app/cv-examples, linked in the footer and from the template gallery and resources page): a finished example CV for each of seven tech jobs (software, frontend, backend, DevOps, data analyst, QA and IT support) with tips for that job and its typical skills. "Edit this example" copies the example into your browser as a new CV and opens the editor; nothing is sent anywhere, every press makes a new copy and your existing CVs are never touched. All people and contact details in the examples are invented. German versions are added as soon as they have been reviewed.
- Your data (enginecv.app/your-data, linked in the footer, the privacy and cookie pages, the dashboard sidebar and the editor's command palette) shows everything EngineCV keeps in this browser: your CVs, saved versions, templates, settings, small choices and cookies, each with what it is for, who set it, how long it is kept, its size and when it last changed. Anything EngineCV does not recognise is shown too, not hidden. It also lists the cookies EngineCV cannot see (from its host and, if you allowed ads, from Google) and how to remove them, and what EngineCV keeps on its servers (no accounts and none of your CV content).
- Download my data saves all of it in one file that people and programs can read, with a short explanation at the top in your language. You can protect it with a password, and importing it on the dashboard brings your CVs back.
- Delete all my data removes everything EngineCV stored in this browser in one go: CVs, saved versions, templates, settings and cookies, including the ones its pages cannot reach. It shows what will be deleted, offers a download first, and asks you to type the confirmation word (or hold the button for two seconds). Other open EngineCV tabs stop saving and reload, so nothing is written back. Afterwards it checks that nothing is left, tells you about anything it could not remove, and starts fresh.
- JSON editor: two compact switches at the top. Standard or Vim picks how you edit; Live or On save picks when changes reach your CV. Live updates the CV and preview as you type whenever the JSON is valid, and waits while it is not. On save waits for Apply, Ctrl+S or `:w`. Both choices are remembered in this browser.
- JSON editor: the status bar shows the cursor's line and column (for example "Ln 5, Col 21").
- JSON editor: if a browser extension such as Vimium takes the Esc key away in Vim mode, the editor says so and suggests excluding the site in that extension.

### Changed
- The cookie and storage policy now lists exactly what EngineCV stores, from the same list the Your data page uses, so it can no longer fall behind. It now also names two small choices that were missing: the "made with EngineCV" line in the GitHub README export and the dismissed language hint.
- JSON editor: Apply, Ctrl+S and Vim `:w` save straight away instead of opening a review dialog, and saving with nothing changed does nothing. Undo apply still reverts a whole apply, and a CV changed elsewhere still asks first. The Apply button is quieter, and Ctrl+S inside the editor applies your changes instead of opening the browser's save dialog.

## [2026-10-28]

### Added
- Edit as JSON: open the JSON editor tab to edit your CV’s stored data with live validation, schema-based completion and hover help. Review changes before applying, undo an apply in one step, repair messy pasted JSON, format or sort keys, hide internal fields and optionally enable Vim mode. Everything stays in your browser.
- Paste from AI: let any chat assistant write your CV, then paste its answer into EngineCV. Choose "Paste from AI" when you create a CV (or open /dashboard?start=ai), and "Copy instructions for your AI" gives you a prompt in your interface language that tells the assistant exactly how to answer and never to invent employers, dates or grades. Before anything is saved you see what will be imported, section by section, and every value that was fixed, adjusted, left out or worth checking, with its place in the answer. Code blocks, text around the CV, curly quotes, comments and stray commas are repaired for you. Everything happens in your browser; nothing you paste is sent anywhere.
- Copy for AI in the export window copies your CV as compact text an AI can read and improve; paste its answer back with Paste from AI. Date of birth, ID numbers and other sensitive details are left out unless you tick "Include personal details".
- Drop a CV file onto the dashboard to import it. Files written by an AI or a script in the EngineCV authoring format (.enginecv.json) open the same summary as Paste from AI; EngineCV exports import as before, also through Import JSON.
- The authoring format is published at enginecv.app/schema/authoring/v1.json, so AIs and tools can read exactly what EngineCV accepts.

### Changed
- The JSON editor now uses a compact icon toolbar and bottom Vim status bar with the Vim logo and monospace mode labels. Escape returns to Normal mode without leaving the editor.
- The summary in Personal details now supports Markdown like entry descriptions do: the same editor with bold, italic, lists and links, rendered in the preview and every export. In the preview you can select it and double-click to edit it in place, like your name and job titles. Summaries written as separate lines keep their line breaks.
- The dashboard header is tidier: "New Resume" is now "New", "New from GitHub" moved into the New menu, and the sort and page-size menus show just their icon (and the page size number).

## [2026-10-25]

### Added
- Export a GitHub profile README from the export window. It turns your CV into a README for your `<username>/<username>` repository: headline, location, summary, skills as badges, recent roles, top projects and links, in the CV's own language. You choose which sections to include and how many roles, projects and skills to show. Email and phone are left out unless you switch them on, because a profile README is public. A rendered preview shows how it will look, and a Markdown tab shows the text to paste; the window can be resized from its corner. Optional extras: a profile card in light and dark versions that follows the visitor's GitHub theme, a link to your CV as PDF, and a small "Built with EngineCV" line. Copy the Markdown, download either card, or download everything as a .zip.
- Add projects from GitHub to a CV you already have. "From GitHub" on the Projects section accepts a repository link, owner/repo or a username, lists the public repositories that are not on the CV yet, and adds the ones you pick as projects with their description, languages, topics and dates. Your existing projects are not changed.
- Projects can have a small icon in front of their name; pick one in the project's editor or leave it at "No icon". Projects that link a GitHub repository can also be marked Public or Private, and "Show Public / Private on GitHub projects" under Customize › Repository Badges shows that label on every such project, in the CV's language. Repositories added from GitHub are marked Public automatically.
- Sort your CVs and templates on the dashboard by last edited, date created or name, and choose 12, 24, 48 or all per page. Long lists get previous and next page buttons. The choices are remembered on this device.
- A new resources page for people looking for work in Germany, Austria or Switzerland: where to learn and prove your German, how to get qualifications recognised, the Western Balkans regulation and the public job boards, in all five languages.
- Localized blog indexes with fewer than three published posts offer a translated "More posts in English" link when English has additional articles. It opens the English blog without changing the saved interface language.

### Changed
- Dragging to reorder is smoother and works everywhere: section order in Customize, personal details, entries on the content cards, and skills, which can also be dragged into another group (even an empty or collapsed one). Other items move aside while you drag, it works with touch, and every grip can be used from the keyboard: Space or Enter to pick up, arrow keys to move, Space or Enter to drop, Escape to cancel. Screen readers announce each step in the interface language.
- Both GitHub import windows now explain that the requests go straight from your browser to GitHub, which sees your IP address, with no EngineCV server in between. EngineCV never signs you in to GitHub, so only public repositories are read, even if you are signed in to GitHub in the same browser. The privacy policy says the same.

### Fixed
- English blog documents retain the correct page-language attribute when a different interface language is saved. One document-level controller now owns the attribute, preventing shared controls from overwriting it.
- Navigation keeps the selected language across blog indexes, home logos and landing-page section links, including the return from the dashboard. Localized blog indexes show a translated empty state until articles are published, rather than sending visitors to English.
- Shared form controls, personal-detail fields, template editing and descriptions, icon names, driving-license descriptions, calendar controls and Markdown tooltips now follow the interface language. Contact and supporter pages are translated too; custom resume/template content keeps its own language.
- Blog ad placeholders no longer appear when ads are disabled or unconfigured. Ads require both the local preference and a live consent-provider signal, and cannot load in editor/export flows or on Bosnian content. A configured publisher ID supplies the ads.txt record.

## [2026-10-09]

### Added
- A new, empty dashboard asks "How do you want to start?" and shows every way to begin on one screen: a blank CV, an example, or an import from LinkedIn, Europass, GitHub or an EngineCV JSON file.
- Four example CVs to start from: software developer, nurse, sales and office, and student or graduate. Each fits on one page and rates its languages skill by skill on the A1–C2 scale. The example text is in English for now; German and Bosnian versions will follow after review.
- Links can open a start path directly, for example /dashboard?start=europass opens the Europass import and /dashboard?start=example the example picker.
- Before your first PDF export, the export window explains the print dialog that comes next: choose "Save as PDF" to keep links clickable, turn off headers and footers. Afterwards the tip stays one click away under "How to save as PDF".

### Changed
- Opening the app from a German, Bosnian, French or Spanish page (a blog post, the template gallery) now opens it in that language.

## [2026-10-08]

### Added
- The blog can now publish articles in German, Bosnian, French and Spanish at their own addresses (for example /de/blog/…), each page fully in that language. Search engines see which pages are translations of each other, and the language menu takes you to the same article in another language when it exists.
- A new article on stating language levels on a CV: what A1 to C2 mean, how to rate each skill, how Goethe, ÖSD, telc, TestDaF and DSH map to the levels, and what employers in Germany and Austria commonly expect. The German and Bosnian versions are being reviewed by native speakers and are marked as drafts until then.

### Changed
- The home page loads much faster on phones: it downloads about 360 KB instead of 1.6 MB. The interactive template demo loads once you scroll to it, the dashboard and template gallery load when you point at or tap their links, and each language is downloaded only when you use it.
- Blog reading times are now counted from the full articles; several posts showed "1 min read" although they take three or four minutes.
- Blog pages stay in the language of their address, whatever language you picked elsewhere in the app, and their labels use proper accents and umlauts in every language. The footer section titles are translated too.

## [2026-10-06]

### Added
- A template gallery at /cv-templates: browse all eight templates with filters, and open a page for each one with its preview and what it is good for. The gallery is also available in German, Bosnian, French and Spanish.
- Landing pages in German, Bosnian, French and Spanish at /de, /bs, /fr and /es, rendered in that language on the server so search engines and link previews see it. The English page at / suggests your language in a banner you can dismiss; it never redirects you.
- Two new templates: Photo Header, and Lebenslauf, a German-style CV with a portrait photo, a date column on every entry and a place, date and signature line.
- After your 1st, 5th and 15th PDF or DOCX export, a small card asks whether you would like to support EngineCV on Ko-fi. Close it, or choose "Don't show again" and it stays gone.
- A /supporters page thanking the people who support EngineCV.
- Nine more fonts to choose from: JetBrains Mono, IBM Plex Sans, IBM Plex Mono, Source Sans 3, Source Serif Pro, EB Garamond, Lora, Courier Prime and Atkinson Hyperlegible Next. Like the other fonts, they ship with EngineCV, so using them sends nothing to a font service.
- Every font in the picker comes with all of its weights and real italics, so thin, black and italic text looks the way the typeface was designed instead of being imitated by the browser.
- Four free tools at /tools, each with its own page in all five languages: turn a Europass CV or a LinkedIn data export into an editable CV, build a developer CV from your GitHub profile, or rate your language level from A1 to C2 skill by skill and add it to a CV. Files and answers are processed in your browser and never uploaded.

### Changed
- EngineCV now has eight distinct templates instead of eighteen near-duplicates: Modern, ATS Plain (formerly Compact), Sidebar, Photo Header, Lebenslauf, Timeline, Executive and Developer. Links to a retired template open its closest replacement, and your resumes keep their design unchanged.
- Every template preview now uses a realistic one-page sample resume and fits all of its sections on one A4 page.
- Template previews load much faster: the dashboard Templates tab downloads about 420 KB instead of 3.9 MB on a desktop, and about 370 KB instead of 1.3 MB on a phone.
- The Templates links in the navigation, hero and footer open the new gallery.
- Header contact links no longer show a link marker by default, since each item already has its contact icon. Links on entries show their marker after the name instead of before it.

### Fixed
- Downloads work on Android phones. HTML, Markdown, text, Word, JSON and PNG exports failed in Chrome on Android with "Download failed".
- On a phone, HTML, PNG and SVG exports and HTML copy work from the content tab. Picking one of these formats now shows the preview, which they are made from.
- The dashboard and editor are fully translated in German, Bosnian, French and Spanish. About a hundred labels, buttons, placeholders and dialogs previously fell back to English.
- Sidebar places skills and certificates in the side column, as its layout intends.
- Timeline gives entry text the wide column, so descriptions no longer squeeze into the narrow side.
- Skills no longer get a globe icon or a wrong brand logo (such as "Prototyping" showing the Protocol Buffers logo); an icon appears only for a recognised brand or one you picked.
- Wrapped date ranges in the experience section line up with the rest of the date column.
- "Pagenumbers" now reads "Page numbers" in the footer options.

## [2026-10-02]

### Added
- Links to EngineCV pages now show a preview card with a title, description and image when you share them on LinkedIn, Reddit, WhatsApp, Discord or X.

## [2026-09-20]

### Added
- Import a Europass CV: "New from Europass" on the dashboard reads a Europass PDF or XML file in your browser and turns it into an EngineCV resume, including the current and older Europass formats.
- Rate each language per CEFR skill (listening, reading, spoken interaction, spoken production, writing) in a grid, with the overall level derived from it. Europass imports keep the grid they came with, and DOCX, Markdown and plain-text exports include the per-skill levels.
- A skip link on every page, so keyboard and screen-reader users can jump straight to the main content.
- An accessibility statement at /accessibility: the standard EngineCV targets, how it is tested, and the known gaps.
- A consent prompt for ads. Nothing ad-related loads until you choose, and you can change your mind at any time on the Cookie and Storage Policy page.

### Changed
- Resume previews and PNG or SVG exports no longer load fonts from Google. The built-in fonts ship with EngineCV, so rendering a resume sends nothing to Google. Fonts you add yourself by URL still load from wherever you point them, which the app now says next to the field.
- Section headings in every template are slightly tighter. Wide letter-spacing made PDF text extractors read headings one letter at a time, so a CV parser could not find the sections.
- The landing page and legal pages describe what the product actually does: the export-format list comes from the product itself, the template claim says the templates are tested for text extraction rather than "ATS-friendly", and claims about capabilities that do not exist (accounts, sync, managed AI) are gone.
- The privacy and cookie policies now list every case in which data can leave your device, and explain the cookieless page analytics on enginecv.app.

### Removed
- All product analytics: Google Analytics, the analytics events and the analytics code in the app are gone. enginecv.app still counts page views through Cloudflare's cookieless measurement, which is described in the privacy policy.
- Referral links no longer store anything about you. They count visits, with no cookie and no derived value from your IP address.

### Fixed
- Text in exported PDFs now comes out in reading order. Faded text such as your headline, entry dates and descriptions was extracted after the sections below it, which is the order a CV parser reads.
- Colours across the app meet the WCAG AA contrast minimum; secondary text was previously too faint to read reliably.
- Dialogs behave properly for keyboard users: focus moves into them, Tab stays inside, Escape closes them, and focus returns to what opened them.
- Form fields in the editor announce their labels to screen readers, and icon-only buttons have names.
- Preview zoom controls stay visible while they have keyboard focus.
- Picking a different dashboard tab after following a link to Templates now switches tabs instead of snapping back.

## [2026-09-14]

### Added
- Export your resume as an editable Word document (DOCX) that uses your template's font and accent colour, with an optional profile photo.
- Markdown and plain-text exports, for GitHub profiles, personal sites and job-portal forms that only accept pasted text.
- A Copy button in the Export dialog and command palette that places your resume on the clipboard, formatted for documents and emails and as clean text everywhere else.

### Changed
- The command palette's export actions and default-format preference now list every export format, including the new ones.
- Exported file names drop characters that some operating systems reject, so resumes titled with slashes, colons or quotes download cleanly.

### Fixed
- A saved default export format that is no longer available now falls back to PDF instead of resetting your other preferences.

## [2026-09-11]

### Fixed
- Zooming the preview with Ctrl + mouse wheel no longer freezes the editor.
- The preview no longer hangs when fit-to-page zoom sits right at the point where a scrollbar appears or disappears.
- Your saved preview zoom level is restored exactly on your next visit instead of drifting slightly each session.

## [2026-08-10]

### Added
- Canva-style overlay editing directly on the resume preview: select a layer for nearby quick actions, drag and resize with snapping guides, double-click text to edit it, duplicate or reorder layers, and click away to deselect.
- Overlay Elements now appears in the Content panel, with localized labels and a live element count.

### Changed
- Resume section labels and language-assessment wording now follow the CV language independently from the app interface language.
- Personal-detail cards can only be reordered from their drag handles, keeping text selection and the caret reliable inside their fields.

### Fixed
- Personal-detail links keep native browser behavior and correctly normalize bare, protocol-relative, and mixed-case URLs.
- Empty editable fields no longer show ellipses or reserve blank description space in the resume.
- Preview pagination remeasures after font, resize, and fullscreen changes and keeps content clear of the footer, preventing page overlap in normal and fullscreen views.

## [2026-08-02]

### Added
- Multiple email addresses in Personal Details, each with its own label, visibility control and preview output.
- A visible CV language selector in Content, localized date-picker controls and nationality display styles for country, citizenship or both.
- More profile-photo shapes, including circle, rounded, square, portrait and landscape presets.

### Changed
- Command palette search now reaches nested actions directly while preserving grouped browsing through Customize and other submenus.
- Bosnian UI wording uses šablon instead of predložak, and new editor controls are translated across all five interface languages.
- Date fields follow the selected CV language by default and keep manually entered years intact.

### Fixed
- Empty project names no longer render a placeholder title in the finished resume.
- Bullet and numbered-list buttons toggle markers cleanly instead of stacking duplicates on repeated clicks.

### Thanks
- **milos7890** on Discord again — for detailed suggestions on CV-language discoverability, localized personal details, photo shapes, compact project layouts and list editing.

## [2026-07-30]

### Added
- Section-level customization: switch between Whole Resume and Current Section, override headings, content styling, entry layout, link icons and specialized section options, then reset any local change to inherit the resume-wide setting again.
- Customize directly from the resume preview: open a section's context menu and jump into its relevant local customization options.
- A nested Customize menu in the command palette. Press Ctrl+K, choose Customize, then browse or search every customization section grouped by Starting Point, Appearance, Document, Header, Sections and Advanced. Selecting one opens that exact panel.

### Changed
- The Customize panel now follows the command palette's cleaner navigation model: searchable grouped rows open one focused detail view instead of presenting a long stack of competing controls.
- Command palette submenus support breadcrumbs, scoped search and keyboard navigation; Escape or Backspace on an empty search returns to the previous command level.

### Fixed
- On mobile, the open actions menu now stays above the Customize search controls, and Send Feedback lives inside that menu instead of competing for header space.
- Resume previews on dashboard cards are excluded from keyboard focus, so Tab moves between card actions instead of entering links and fields inside the miniature resume.

## [2026-07-29]

### Added
- A command palette in the editor: press Ctrl+K (⌘K on a Mac) and search for what you want instead of hunting for it. Saving, exporting, templates, auto-save, the AI and history panels, focus mode, theme, language and the shortcut list are all one search away, and searches match plain terms like "pdf" or "dark" whatever language the interface is in.
- Jump straight where you want to work: the palette can put the caret on the first field of the resume itself — where the arrow keys take over — or open the Content or Customize panel.
- Add Content is in the palette, so a new section no longer needs a trip to the bottom of the sidebar.
- Panel size presets in the palette: balance the panels, give the resume more room, or give the editor more room. The proportions hold whether or not the right-hand panel is open.
- A keyboard shortcut reference: press `?` — or the keyboard button in the header — for every binding, grouped by what it does and shown with the right keys for your platform.

### Changed
- The editor header lost its File / View / Help menu bar. History, the AI panel and the shortcut list are now buttons that match the rest of the header, everything else moved into the command palette, and Export is no longer the loudest thing on screen.
- The export dialog is a single quiet panel instead of a wide two-column one: formats sit in a compact row, each format's options appear directly beneath it, and the confirm button matches the one in the header. Every format, the JSON sidecar and the encryption options work exactly as before.

### Thanks
- **milos7890** on Discord again — for pointing out that shortcuts nobody can find may as well not exist, and that the old menu bar sat awkwardly against everything else in the header.

## [2026-07-24]

### Added
- Edit in place in the live preview: double-click a field — name, headline, job title, company, location, or an experience description — and type where it renders. Rich fields keep bold, italic and underline; single-line fields stay plain text.
- A floating toolbar follows the field you are editing, with formatting buttons on rich text and a font-size stepper on plain fields that adjusts the matching global size setting.
- Keyboard control in the preview: Tab and Shift+Tab or the arrow keys (and vim-style `h`/`j`/`k`/`l`) move between fields, `g` and `G` jump to the first and last field, Enter, F2, `i` or `a` start editing, Esc leaves, and Tab while editing commits and moves to the next field.
- Experience start and end dates are individually editable in the preview; the end date and its separator only appear when the role has one.
- "Open link" in the preview element menu opens the clicked contact link, entry subtitle link or repository badge in a new tab.
- Custom sections: build your own section and pick its layout — an entry list, a free markdown text block, or a row of tags. Several can coexist, and each supports the usual ordering, placement, hiding and drag-reordering.
- Skill badges under entries: a new Customize → Entry Layout toggle renders the skills tagged on an entry as badges, either below the entry body or under its subtitle. The same skills can still appear in the Skills section.
- Font roles: choose a primary font for headings, a secondary font for body text and a mono font for tags, skills and repository badges; per-element font settings can follow a role or override it.
- Skill logos can render in a single colour, in their real brand colours, or in one custom colour of your choice.
- Multi-select entries in the Content panel with a bulk action bar to hide, show or delete them; bulk delete asks for confirmation and lists what it will remove. Individual entry rows gained their own delete button.
- The resume header — name, headline, contact details and photo — now highlights on hover and opens Personal Details on click, and each skill group is its own hover and click target.

### Changed
- Content panel: clicking an entry opens that entry's editor directly, while the pencil opens the section's own settings. The separate full entry list is gone, and adding an entry takes you straight into it.
- The single-entry editor sits flush in the panel instead of as a card inside a card, names the section it belongs to, and its Get Tips, show/hide and delete actions moved up into the section header.
- Section heading fields are shown directly instead of behind a collapsible toggle.
- Multi-select checkboxes now use the app's own colours instead of the browser default.

### Fixed
- Saving as PDF from the browser print dialog produces real, selectable text with working links again, instead of flattening the page into an image.
- The preview hover outline no longer leaks into PNG, SVG or PDF exports.
- Resume thumbnails on the dashboard behave like static images — no accidental zoom, pan or hover outlines.
- Editing a plain field in the preview no longer errors when the formatting toolbar appears over it.
- The name and headline in the preview are clickable again for jumping to Personal Details.

### Thanks
- **milos7890** on Discord, whose idea the keyboard-first editing in this release was — Tab between fields, Word-style Ctrl+B/I/U, and shortcuts that work the way they do everywhere else.

## [2026-07-15]

### Added
- Publications section: record papers, articles, or books with a title, publisher, optional date, and a rich-text description.
- References section: list professional references with their name, job title, organisation, email, phone, profile link, and an optional note.
- Declaration section: add a signed statement with a drawn or uploaded signature, full name, place, and date — the signature is stored with your resume and rendered in the preview and PDF export.

## [2026-07-10]

### Added
- Light, dark and system theme switching across the app.
- User-defined skill groups, including grouped skill rendering, group visibility, and grouped skill import handling.
- GitHub import now includes collapsible repository and organization pickers, and can import selected public GitHub organization memberships as Organisation entries.

### Changed
- Language picker buttons now consistently show the language icon and current language code across desktop, mobile, dashboard, editor, and template editor surfaces.
- Count-based labels now use singular and plural wording correctly across imports, warnings, and skill import messages.

### Fixed
- Editor mobile header spacing no longer overflows after adding theme and language controls.
- Applying templates keeps Languages Section styling settings intact.

## [2026-07-09]

### Added
- Public changelog page at `/changelog`, rendered straight from this file and linked from the site footer.
- Create a resume from a public GitHub profile with deterministic browser-side import, repository curation, and no AI.
- Hide entire sections or individual entries from the resume with one click — hidden content stays editable and in your backups, it just doesn't render or export.
- Section cards in the editor show a live count of their entries, plus how many are hidden.
- Templates now open as resume starting points from landing and dashboard cards instead of routing straight into template editor.
- Language entries now support optional assessment verification details for native fluency cases, including issuer and verification link fields.
- New "Languages Section" customize card: switch between list and table layouts, flow the list into up to three columns, tune entry spacing and table cell padding, and show the fluency level as a badge, plain text, or hide it — with an adjustable size.
- Languages Section: place the fluency level inline with the language name (in either order) and align text left, center, or right in both list and table layouts.

### Changed
- Customize panel now opens with Templates expanded and all other sections collapsed.
- Removed the redundant instant-delete trashcan from entry headers; deleting an entry now always goes through the confirmed delete button on the entry card.

### Fixed
- Two-column and mixed layouts: a tall section now fills the remaining space in its column and continues on the next page, instead of jumping to a fresh page and leaving the first page half empty. Columns also paginate independently, so one overflowing column no longer pushes the other column's sections to the next page.

## [2026-06-25]

### Changed
- The Section Heading editor starts collapsed to keep the editor sidebar tidy.

### Fixed
- Long resumes no longer overflow into the footer band or bottom margin on any preview page; pagination is now consistent between the live preview and the PDF export, including two-column layouts.

## [2026-05-29]

### Added
- Skills section: add skills with a proficiency level, icon and display style, and tag the skills you used on individual experience, education, project and certificate entries. Skills render in the preview and exported PDF.
- Personal Details customization is split into three focused sections so settings are easier to find.
- Template selector redesigned as a preview strip with a full picker dialog.

### Changed
- Customize sections start collapsed by default, and the panel gained a close button.

## [2026-05-23]

### Added
- Focus Mode in the editor for distraction-free writing.
- Grid density (zoom) control for resume and template cards on the dashboard.

## [2026-05-21]

### Added
- New EngineCV logo and wordmark across the app.
- Collapsible dashboard sidebar and sticky tab toolbars that survive browser zoom.

### Changed
- New content sections default to full-width placement in mixed layouts.

### Fixed
- Preview no longer drifts or blurs while Ctrl+wheel zooming.

## [2026-05-19]

### Added
- Pricing page with Free, Pro and Agencies plans, one-time credit top-ups, and a reusable FAQ — fully translated.

## [2026-05-18]

### Added
- Link multiple repositories to a project with branded badges, plus customize controls for badge styling.
- Accent-colored Export button in the desktop editor navigation.

## [2026-05-14]

### Changed
- Language entries are standardized with fluency, assessment type and issuer fields.

### Fixed
- Resume import shows detailed, specific error messages when a file can't be read.
- Entry spacing units and column measurement in the Customize panel.

## [2026-05-12]

### Added
- Structured personal details: date-of-birth picker, phone numbers with country flags and prefixes, searchable nationality and country pickers, driving license classes, passport / national ID entries, marital status, disability, visa and military service entries — each with display toggles that drive the preview.
- Interests content section.
- Contact page, plus founder and support contact emails in the footer.

## [2026-05-09]

### Added
- Feedback system: report bugs or ideas from any page, with an announcement marquee highlighting what's new.

### Fixed
- Resume preview can no longer be dragged outside the visible area.
- Content no longer overflows over the bottom footer when margins are small.

## [2026-05-08]

### Added
- 10 new built-in resume templates with broader border treatments, previewed at full fidelity in the landing page carousel.
- Vertical alignment control for link and header icons.
- App version shown in the footer.

### Changed
- Roomier default spacing for section headings and summaries.

### Fixed
- PNG export canvas now matches the intrinsic page size.

## [2026-05-06]

### Added
- Templates system: save any resume as a reusable template, browse templates in the editor and dashboard, and manage them in dedicated dashboard tabs (Resumes / Cover Letters / Templates).

### Fixed
- Tighter mobile layout on the landing page and hardened editor touch interactions.

## [2026-05-04]

### Added
- Public launch readiness: production build repaired, early-access notices added, and AI surfaces gated behind an early-access flag.

### Fixed
- Garbled characters in translations repaired and Latin-extended font subset loaded for South Slavic languages.
- Language picker flips upward when there is no space below.

## [2026-05-02]

### Added
- Blog with author sidebar, table-of-contents rail, and practical resume/ATS articles.
- Profile photo rotation control.
- Collapsible customize section cards whose state persists across tab switches.

### Fixed
- Removing a content section now removes it from the preview and deletes its data after an inline confirmation.

## [2026-04-12]

### Added
- Resume JSON travels with PDF exports as a sidecar, so an exported PDF can be re-imported later.
- Visible slim scrollbars in the editor side panels and site-wide.

### Changed
- Dialed back border radii on cards and modals for a crisper look.

## [2026-03-22]

### Added
- Duplicate button and live resume previews on dashboard cards, in a responsive grid.

### Fixed
- Imported resume settings are clamped to safe ranges so a bad file can't break the UI.

## [2026-03-21]

### Added
- Section heading customization with 8 presets, border color, and dash controls.
- Entry Layout controls with a dual-thumb proportion slider.
- Personal details layout presets, profile photo and profile block styling controls.
- Editing history with keyboard shortcuts, merged into a tabbed side panel.

## [2026-03-19]

### Added
- Choosable link indicator icons on entry subtitles, contact items and markdown links, with side and size settings.
- Editable resume metadata (title and tags) from the editor header.
- Search bar in the customization panel.

### Changed
- Vectorized PDF is the default export, and export preferences persist.

## [2026-03-11]

### Added
- Full internationalization in five languages: English, Bosnian, German, French and Spanish — including CV-language-aware dates in the preview.
- HTML resume export and encrypted JSON import/export.

## [2026-03-10]

### Added
- Layout separators, vertical section joins and manual page breaks in the document flow.
- Profile photo crop and remove flow.
- Dual document units (mm and px) in the sidebar.

## [2026-03-09]

### Added
- Projects and Certificates content sections with full editors and preview rendering.
- Autocomplete suggestions and tag chips for profile fields.
- Export menu with JSON, PDF, PNG and SVG formats; multi-page SVG export.
- Zoom and pan controls in the resume preview.
- Global typography scaling and advanced color palette controls with functional accent targets.

### Changed
- Reliable page pagination with DOM-measured page chunking for preview and PDF export.

## [2026-03-08]

### Added
- Landing page and overhauled dashboard with create, delete and auto-save flows.
- Rich entry editing: markdown editor, date pickers, drag-to-reorder cards, and per-section heading and icon customization.
- AI resume patch pipeline for structured, reviewable AI edits.

## [2026-03-06]

### Added
- First working editor: AI chat with streaming providers and Chrome AI support, resizable panels, auto-scaling live preview with fullscreen toggle, custom Google Font imports, and configurable paper sizes.

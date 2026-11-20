import type { Metadata } from "next";
import Link from "next/link";
import { DataMapDiagram } from "@/components/diagrams/DataMapDiagram";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
    title: "Privacy Policy: What EngineCV Stores and Shares | EngineCV",
    description: "What the EngineCV resume builder keeps on your device, every case where your data can leave it, and the cookieless page analytics it uses, in plain language.",
    path: "/privacy",
});

export default function PrivacyPage() {
    return (
        <LegalPage
            eyebrow="EngineCV Legal"
            title="Privacy Policy"
            description="EngineCV is a local-first resume builder. This policy lists what stays on your device and every case in which data can leave it, including the cookieless page analytics EngineCV uses."
        >
            <LegalSection title="1. Your resumes stay on your device">
                <p>
                    Resumes, cover letters (and the paragraphs you save for them), version history, templates, and preferences
                    are stored in your browser on this device (IndexedDB and localStorage). EngineCV has no account system and
                    keeps no server copy of your resumes or letters. Editing, preview, version history, and exports to PDF, DOCX,
                    Markdown, plain text, HTML, LaTeX, and JSON happen in your browser without sending your resume or letter
                    anywhere.
                </p>
                <p>
                    If you clear browser storage, switch browsers, use private browsing, or reset the device profile, that
                    local data can be removed. Keep your own exports or encrypted JSON backups.
                </p>
                <p>
                    A CV can also be kept in a file on your computer if you choose to link one (section 5). That file is outside
                    the browser&apos;s storage.
                </p>
                <DataMapDiagram detailed />
            </LegalSection>

            <LegalSection title="2. Page analytics">
                <p>
                    enginecv.app counts page views with Cloudflare Web Analytics. It is cookieless: it stores nothing on your
                    device, sets no identifier, and does not follow you to other sites or build a profile of you. What it
                    reports is aggregate: page views, the page address and referring site, country, browser and device type, and
                    page loading performance. It is added by the hosting layer, so a self-hosted copy of EngineCV does not
                    include it.
                </p>
                <p>
                    Your resume never reaches it. The script measures the page you are on; it cannot read what you type, your
                    saved resumes, or your browser storage.
                </p>
                <p>
                    EngineCV also keeps one anonymous counter: when an export finishes, your browser tells EngineCV that one
                    file of a given format (for example PDF) was exported, and which link or site brought you here (a
                    referral name, a <code>utm_source</code> value, or the referring site&apos;s host name; kept only in this
                    tab). It also notes a few coarse facts: your country (from the network edge, never your IP address), the
                    site language, the built-in template you used, the first page of your visit (the address only, never a
                    document id), a role example page if you came from one, and whether you are on a phone or a computer. It
                    carries no cookie, identifier, IP address, resume content, file name or name. It is not sent at
                    all if your browser sends Do Not Track or Global Privacy Control. It exists to show which channels lead to
                    finished CVs, not to follow anyone.
                </p>
                <p>
                    The same counter notes a click on a marked &quot;Partner link&quot; on the Resources page: which link it
                    was and the same source, nothing about you. Partner links are affiliate links: if you sign up or buy
                    after following one, the partner may pay EngineCV a commission at no extra cost to you, and the partner
                    then sets its own cookies on its own site under its own policy. Links without the label are unpaid and
                    carry no tracking.
                </p>
                <p>
                    EngineCV uses no other analytics: no Google Analytics, no tracking pixels, and no tracking of what you
                    do in the app beyond that counter. Earlier versions could load Google Analytics; if a browser still has first-party analytics
                    cookies from that time (<code>_ga</code>, <code>_gid</code>), EngineCV deletes them on your next visit.
                </p>
            </LegalSection>

            <LegalSection title="3. When data can leave your device">
                <p>
                    Apart from the hosting provider (section 8) and the page analytics it adds (section 2), these are all the
                    cases in which your browser contacts a third party while you use EngineCV:
                </p>
                <ul className="list-disc space-y-2 pl-6">
                    <li>
                        <strong>Custom fonts you add.</strong> The built-in resume fonts are served by EngineCV itself. If you add
                        a font by URL in Customize, your browser loads it from the address you entered; for Google Fonts that
                        means Google receives your IP address and browser details whenever that font is shown or exported.
                    </li>
                    <li>
                        <strong>GitHub import.</strong> When you create a CV from a GitHub profile, or add GitHub repositories as
                        projects to an existing CV, your browser asks GitHub&apos;s public API (<code>api.github.com</code>) and{" "}
                        <code>avatars.githubusercontent.com</code> for the profile or repository, its public repositories,
                        languages, and avatar. These requests go directly from your device to GitHub; no EngineCV server sits in
                        between or sees them. GitHub receives the username or repository name, your IP address, and browser
                        details. EngineCV never signs you in to GitHub and sends no GitHub token or cookie, so only public data
                        is read and private repositories are never included, even if you are signed in to GitHub in the same
                        browser.
                    </li>
                    <li>
                        <strong>Ads, only if you allow them.</strong> See section 6.
                    </li>
                    <li>
                        <strong>Feedback.</strong> Sending feedback opens a pre-filled GitHub issue or email in your own browser
                        or mail app. Nothing is sent until you submit it there.
                    </li>
                </ul>
                <p>
                    AI writing features are not available in EngineCV today. If they are added, this policy will say what
                    they send and to whom before they are offered.
                </p>
            </LegalSection>

            <LegalSection title="4. Imported files">
                <p>
                    LinkedIn data-export archives and Europass CVs (PDF or XML) are read entirely in your browser. They are not
                    uploaded to EngineCV or any third party, and EngineCV does not contact LinkedIn or Europass to import them.
                    Only the resume you confirm is kept, on your device. GitHub import is different because it has to ask
                    GitHub for the profile (section 3).
                </p>
                <p>
                    Import only data that belongs to you. EngineCV is not affiliated with or endorsed by LinkedIn, GitHub,
                    Europass, or the European Union.
                </p>
            </LegalSection>

            <LegalSection title="5. Workspace folder and AI agents">
                <p>
                    In Chromium browsers you can also connect a <strong>workspace folder</strong>. EngineCV then writes your CVs
                    and cover letters into that folder as plain files (including your contact details unless you turn on
                    &quot;leave contact details out&quot;), plus a few instruction and index files for AI agents and a small
                    activity log, and it reads your edits back. You choose the folder, your browser asks for permission first,
                    and EngineCV only touches the files it made. The folder and its files stay on your computer: nothing in them
                    is uploaded to EngineCV or any third party. EngineCV keeps the folder&apos;s permission and a per-document
                    sync state, with no document text, in local database tables on this device.
                </p>
                <p>
                    Where else those files go is decided by your own tools. If the folder is inside OneDrive, Dropbox, iCloud or
                    similar, that service copies it. An AI agent you point at the folder may send what it reads to its model
                    provider, and other programs or people with access to your computer can read the files too. Disconnecting
                    leaves the files and your documents in place, and &quot;Delete all my data&quot; does not delete files in
                    the folder.
                </p>
                <p>
                    You can read and change the files with any text editor. Only use agents you trust with your contact details:
                    EngineCV asks you to confirm this before it writes the first file. The data download on{" "}
                    <Link href="/your-data" className="underline">Your data</Link> does not include the folder&apos;s files, and
                    you delete them yourself in your file manager.
                </p>
            </LegalSection>

            <LegalSection title="6. Advertising and consent">
                <p>
                    EngineCV is built so that ads from Google AdSense can be shown to keep it free. Ads are currently{" "}
                    <strong>turned off</strong> on enginecv.app, and they stay off until a certified consent platform is in
                    place. Where a deployment does enable ads, nothing ad-related loads, and no ad cookies are set, until you
                    choose &quot;Allow ads&quot;. If you allow them, Google may set cookies and receive your IP address and
                    browser details to serve and measure ads. Your resumes are never shared with Google.
                </p>
                <p>
                    You can change your choice at any time on the <Link href="/cookies" className="underline">Cookie and Storage
                    Policy</Link> page.
                </p>
            </LegalSection>

            <LegalSection title="7. Referral links">
                <p>
                    Links of the form <code>/r/&lt;slug&gt;</code> redirect to the home page and add one to a counter for that
                    link. EngineCV does not set cookies for this and does not store or derive anything from your visit, such as
                    your IP address, so the counter counts visits, not people. Ko-fi links on EngineCV work the same way:
                    they go through <code>/go/kofi/&lt;placement&gt;</code>, which adds one to a counter for that placement and
                    redirects to Ko-fi. GitHub Sponsors links do the same through <code>/go/sponsors/&lt;placement&gt;</code>.
                </p>
            </LegalSection>

            <LegalSection title="8. Hosting">
                <p>
                    EngineCV is served by Cloudflare. Like any web host, Cloudflare processes your IP address and request details
                    to deliver the site and protect it from abuse, and may set short-lived security cookies (for example{" "}
                    <code>__cf_bm</code>). EngineCV keeps Cloudflare&apos;s standard request logs to debug errors; the page
                    analytics in section 2 are a separate, cookieless measurement.
                </p>
            </LegalSection>

            <LegalSection title="9. Security boundaries">
                <p>
                    Local-first does not mean risk-free. Anyone with access to your device profile or browser storage may be able
                    to read locally saved resumes, and exported files can be copied or shared outside the app. Use device security,
                    backups, and encrypted exports where appropriate.
                </p>
            </LegalSection>

            <LegalSection title="10. Your rights: see, download, delete">
                <p>
                    Because your data lives in your browser, you can use your rights directly, without asking anyone.{" "}
                    <Link href="/your-data" className="underline">Your data</Link> lists everything EngineCV stores in this
                    browser, gives you a copy of all of it in one file (access and portability), and deletes all of it at any
                    time (erasure). For anything else, or about data held by EngineCV&apos;s hosting provider, use the{" "}
                    <Link href="/contact" className="underline">contact page</Link>.
                </p>
            </LegalSection>

            <LegalSection title="11. Policy changes">
                <p>
                    If EngineCV changes how data is stored, transmitted, or monetized, this policy is updated before the change
                    ships.
                </p>
            </LegalSection>
        </LegalPage>
    );
}

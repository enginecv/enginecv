import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { pageMetadata } from "@/lib/site";
import { AgentActionsDiagram, BigPictureDiagram, ChangeJourneyDiagram, FolderLayoutDiagram } from "./diagrams";

const TITLE = "How the workspace folder works";
const DESCRIPTION =
    "Keep your CVs and cover letters as plain files in a folder on your computer. EngineCV follows every change, and an AI agent can edit, create and export them. Nothing is uploaded.";

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/how-it-works" });

const code = "rounded bg-surface-1 px-1.5 py-0.5 font-[family-name:var(--font-geist-mono)] text-[0.85em]";

export default function HowItWorksPage() {
    return (
        <LegalPage eyebrow="How it works" title={TITLE} description={DESCRIPTION}>
            <LegalSection title="In one minute">
                <p>
                    You choose a folder on your computer. EngineCV writes every CV and cover letter into it as a plain JSON file and
                    keeps the files and the app in step, in both directions. Edit a CV in the editor and its file changes. Edit the
                    file in a text editor, or let an AI agent edit it, and the CV in the app changes.
                </p>
                <BigPictureDiagram />
                <p>
                    That is all an agent needs: it reads and writes files with the tools it already has. There is no plugin, no
                    account and no server in between. EngineCV checks every outside change before it applies it, keeps a restore
                    point and tells you what happened.
                </p>
            </LegalSection>

            <LegalSection title="Set it up">
                <ol className="list-decimal space-y-2 pl-6">
                    <li>Use Chrome, Edge or another Chromium browser on a computer. Other browsers cannot open a folder yet.</li>
                    <li>On the <Link href="/dashboard" className="underline">dashboard</Link>, open <strong>Workspace folder</strong> and choose a folder. A new, empty one works best.</li>
                    <li>Read the short warning: the files hold your contact details, so only use agents you trust. You can leave contact details out of the files with one switch.</li>
                    <li>Look over the list of what will be written. Nothing is written until you press <strong>Apply</strong>, and Cancel at any step writes nothing.</li>
                </ol>
                <p>
                    Files that are already in the folder are never touched unless they are EngineCV files you chose to use. If you
                    pick a folder that already holds CV files, EngineCV shows where they differ from the app and lets you decide per
                    file.
                </p>
            </LegalSection>

            <LegalSection title="What is in the folder">
                <FolderLayoutDiagram />
                <p>
                    A CV file holds the content only: name, entries, skills, languages. Design (template, colours, fonts), the photo
                    and the signature stay in the app, so an agent cannot break your layout. A letter file names the CV it follows,
                    so its sender block and design keep following that CV.
                </p>
                <p>
                    <code className={code}>AGENTS.md</code> and the files in <code className={code}>.enginecv/reference/</code> teach an agent the formats in a few
                    hundred words, so you do not have to explain anything. If you delete them, EngineCV puts them back.
                </p>
            </LegalSection>

            <LegalSection title="How a change travels">
                <p>
                    <strong>From the app to the file.</strong> A moment after you stop typing, EngineCV writes the file in one piece, so a
                    program reading it never sees half a file. Renaming a CV renames its file. Deleting a CV asks whether the file
                    should stay or go, and a deleted file is copied to <code className={code}>.enginecv/conflicts/</code> first.
                </p>
                <p>
                    <strong>From the file to the app.</strong> EngineCV notices a saved file within a few seconds while its tab is open and
                    checks it before touching anything:
                </p>
                <ChangeJourneyDiagram />
                <ul className="list-disc space-y-2 pl-6">
                    <li><strong>A mistake costs nothing.</strong> A cut-off or invalid file never changes your CV and is never overwritten. Fix the file and it recovers by itself.</li>
                    <li><strong>Harmless slips are repaired</strong>: a code fence around the JSON, a trailing comma, a byte-order mark, a chat sentence before the JSON.</li>
                    <li><strong>Big deletions need you.</strong> A file that keeps fewer than half of a CV&apos;s entries and drops three or more is held for your review.</li>
                    <li><strong>Sent letters are frozen.</strong> An edit to the file of a letter you marked as sent is refused. To reuse it, an agent writes a new letter file.</li>
                    <li><strong>You can always go back.</strong> Every applied change has a restore point, and the activity list has a one-click Undo.</li>
                </ul>
            </LegalSection>

            <LegalSection title="What an agent can do">
                <AgentActionsDiagram />
                <p>
                    <strong>Edit.</strong> Ask the agent for a change, for example &ldquo;shorten the summary&rdquo; or &ldquo;add my new project&rdquo;. It changes only
                    that value and saves the whole file in one write. The CV in the app updates and you get a notification with
                    <em> Undo</em>.
                </p>
                <p>
                    <strong>Create.</strong> Ask for a new CV based on your master one, or a cover letter for a job. The agent saves a new file
                    and it appears as a new document. A letter names the CV it follows by id, which the agent reads from{" "}
                    <code className={code}>.enginecv/index.json</code>.
                </p>
                <p>
                    <strong>Export.</strong> The agent writes a small request file naming the document and a format (HTML, Word, Markdown,
                    plain text, LaTeX, JSON). EngineCV makes the file into <code className={code}>exports/</code> and writes the answer to{" "}
                    <code className={code}>.enginecv/results/</code>. For a PDF the agent asks for HTML and prints it with headless Chrome or Edge; the
                    exact command for your system is in <code className={code}>.enginecv/reference/exports.md</code>.
                </p>
                <p>
                    <strong>Be noticed.</strong> While EngineCV is open it shows a small notification for a new document, an edit, an export,
                    a change held for review and a refusal. A file cannot say who wrote it, so EngineCV names an agent only if the
                    agent signs its work with <code className={code}>&quot;edited_by&quot;</code> in a file or <code className={code}>&quot;agent&quot;</code> in a request. The name is cleaned and shown as
                    plain text. Unsigned changes say &ldquo;a file&rdquo; instead of guessing. You can turn notifications off in the panel.
                </p>
            </LegalSection>

            <LegalSection title="What keeps your data safe">
                <ul className="list-disc space-y-2 pl-6">
                    <li>The files stay on your computer. EngineCV never uploads them, and the folder is not part of the &ldquo;Delete all my data&rdquo; button.</li>
                    <li>An agent you point at the folder may send what it reads to its model provider. That is your agent&apos;s policy, not EngineCV&apos;s, so use one you trust.</li>
                    <li>&ldquo;Leave contact details out&rdquo; removes email, phone, address and links from the files. The app keeps them, and agents cannot see or change them.</li>
                    <li>Pause stops both directions at once. Disconnect leaves the files and your documents exactly as they are.</li>
                    <li>If the folder sits in OneDrive, Dropbox or iCloud, that service copies the files; if it is a git repository, git does. EngineCV only ever lists conflict copies those tools make and never imports them.</li>
                </ul>
                <p>
                    More detail is on the <Link href="/privacy" className="underline">privacy page</Link> and in{" "}
                    <Link href="/your-data" className="underline">Your data</Link>, which shows exactly what is stored in your browser.
                </p>
            </LegalSection>

            <LegalSection title="Honest limits">
                <ul className="list-disc space-y-2 pl-6">
                    <li>It needs a Chromium browser on a computer (Chrome, Edge, Brave, Opera). Firefox and Safari cannot open folders yet.</li>
                    <li>EngineCV has to be open in a browser tab for changes and export requests to be handled. A request that waits more than ten minutes is answered as expired instead of running late.</li>
                    <li>Changes show up within a few seconds, not instantly. When you come back to the tab, it catches up straight away.</li>
                    <li>After a restart your browser asks for permission to open the folder again. One click restores it.</li>
                    <li>Two tabs do not fight: one syncs and the other says so.</li>
                </ul>
            </LegalSection>

            <LegalSection title="Try it">
                <p>
                    <Link href="/dashboard" className="underline">Open the dashboard</Link>, connect a folder, and ask your agent to make a cover letter. If something
                    here is unclear or does not work the way this page says, <Link href="/contact" className="underline">tell us</Link>, because that is a bug.
                </p>
            </LegalSection>
        </LegalPage>
    );
}

import type { Metadata } from "next";
import Link from "next/link";
import { AgentWalkthroughDiagram } from "@/components/diagrams/AgentWalkthroughDiagram";
import { DataMapDiagram } from "@/components/diagrams/DataMapDiagram";
import { SyncLoopDiagram } from "@/components/diagrams/SyncLoopDiagram";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { AUTHORING_SCHEMA_URL } from "@/lib/agent/authoring/schema";
import { LLMS_TXT_URL, SKILL_URL } from "@/lib/agent/authoring/skill-urls";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
    title: "How Linked Files and the Agent Skill Work | EngineCV",
    description: "How EngineCV keeps a CV in a file on your computer so a local AI agent can edit it: what is stored where, how changes are detected and checked, what happens on errors, and the limits.",
    path: "/linked-files",
});

const AGENTS_SNIPPET_URL = SKILL_URL.replace("SKILL.md", "AGENTS-snippet.md");

export default function LinkedFilesPage() {
    return (
        <LegalPage
            eyebrow="EngineCV Technical"
            title="How linked files work"
            description="A CV can live in a plain JSON file on your computer. A local AI agent, or any editor, changes the file, and EngineCV follows. This page explains what is stored where, how changes are noticed and checked, what happens when something goes wrong, and what the limits are."
        >
            <LegalSection title="1. The idea">
                <p>
                    Link a CV to a file and the file becomes a second copy of it that other programs can edit. EngineCV watches
                    the file, checks every change, and applies a valid one to the CV. Changes you make in the editor are written
                    back to the file. Everything happens between your browser and your disk; there is no EngineCV server in the
                    path.
                </p>
                <p>
                    You link a file from the editor header: <em>Link to a file</em>, then <em>Create a new file</em> or{" "}
                    <em>Use an existing file</em>. If the file already has content you choose whether to load it into the CV or
                    overwrite it with the CV; nothing is decided silently. While linked, the CV name is the file name. To
                    rename it, rename the file in your file manager and relink; EngineCV does not rename files itself.
                </p>
            </LegalSection>

            <LegalSection title="2. What is stored where">
                <DataMapDiagram detailed />
                <ul className="list-disc space-y-2 pl-6">
                    <li>
                        <strong>The file</strong>, in the folder you picked: the CV as JSON in the{" "}
                        <code>enginecv.authoring/v1</code> format, pretty-printed, content only. It includes contact details.
                    </li>
                    <li>
                        <strong>The link</strong>, in this browser&apos;s database (table <code>linkedFiles</code>): the file&apos;s
                        name, when you linked it, whether syncing is paused, and a browser handle that lets the browser open the
                        file again. A handle is not a path; EngineCV never learns where the file is.
                    </li>
                    <li>
                        <strong>The CV and its history</strong>, in the browser as always. Every file update is preceded by a
                        history snapshot, so you can go back.
                    </li>
                </ul>
                <p>
                    Nothing is uploaded. The permission to open the file is held by your browser and shown in its site
                    settings; <Link href="/your-data" className="underline">Your data</Link> lists the link and explains what
                    deleting data does and does not remove.
                </p>
            </LegalSection>

            <LegalSection title="3. How a change is noticed and applied">
                <SyncLoopDiagram />
                <p>Browsers offer no change notification for files, so EngineCV checks:</p>
                <ol className="list-decimal space-y-2 pl-6">
                    <li>
                        About every 1.5 seconds while the tab is visible (2 seconds after a minute without changes), it reads the
                        file&apos;s modified time and size. It does nothing while the tab is hidden and checks at once when you
                        come back. A change is never seen instantly.
                    </li>
                    <li>
                        When the stamp changed it waits 400 ms and checks again, so a program that is still writing is not read
                        half-way. Then it reads the text and compares a hash with the last text it wrote or applied; a
                        newline-only difference is ignored.
                    </li>
                    <li>
                        The text goes through the same reader as Paste from AI: it finds the document, repairs the usual JSON
                        slips, and converts it. A file that is empty, over 200 KB, not a CV document, not valid JSON (with line and
                        column), a full EngineCV export, or in a newer format is rejected and the CV stays as it is.
                    </li>
                    <li>
                        A valid file is applied as one update: a history snapshot first, then the content (details, summary,
                        sections, their order) replaces the CV&apos;s content. Design, template, photo, signature, name and id are
                        kept. The editor shows &quot;Updated from file: N added, N removed, N changed&quot; and any notices.
                    </li>
                </ol>
                <p>
                    Writing back is debounced by 800 ms. Before each write EngineCV checks the file again; if it changed in the
                    meantime the write is cancelled and the file is read first, so an outside edit is never overwritten blindly.
                    Writes use the browser&apos;s writable stream, which replaces the file when it closes, so other programs never
                    see a half-written file. A design-only change does not rewrite the file. After an outside edit the editor may
                    rewrite the file once in its standard form (consistent formatting, entry ids added).
                </p>
            </LegalSection>

            <LegalSection title="4. What the file looks like">
                <p>
                    The format lists a CV&apos;s details, summary and sections as plain JSON. Entries carry an <code>id</code> so
                    edits can be matched to entries; new entries can leave it out. The JSON Schema is at{" "}
                    <a href={AUTHORING_SCHEMA_URL} className="underline">{AUTHORING_SCHEMA_URL}</a>. The file never carries the
                    photo, the signature or the design; a <code>design</code> object an agent adds is ignored.
                </p>
            </LegalSection>

            <LegalSection title="5. When something goes wrong">
                <ul className="list-disc space-y-2 pl-6">
                    <li>
                        <strong>Problem in the file.</strong> The CV and the file are left alone, the editor names the problem and
                        position, and it never writes to the file while the problem lasts. Fix the file and it recovers by itself.
                        An agent that edits in several steps may leave the file briefly invalid between two edits; that is only a
                        passing error state, and the next valid state is applied.
                    </li>
                    <li>
                        <strong>File busy.</strong> Another program holds the file open. The editor retries after 1, 2, 4 and 8
                        seconds, then waits for the next change. The CV is untouched.
                    </li>
                    <li>
                        <strong>File not found or access lost.</strong> This includes a file renamed or moved outside EngineCV
                        (the browser follows files by path, not by identity). The CV is untouched; relink to the file, and the CV
                        takes its name.
                    </li>
                    <li>
                        <strong>Paused.</strong> Both directions are held. On resume the editor tells you whether the file, the CV
                        or both changed and lets you choose which wins.
                    </li>
                    <li>
                        <strong>Permission needed.</strong> After a restart the browser may ask again; one click on{" "}
                        <em>Resume syncing</em> restores the link. When you open a CV, edits made to the file while the tab was
                        closed are applied after a snapshot; if the CV is the newer side the editor asks instead of overwriting.
                    </li>
                </ul>
                <p>One file can be linked to one CV only. Unlinking leaves the file and the CV exactly as they are.</p>
            </LegalSection>

            <LegalSection title="6. The agent skill">
                <AgentWalkthroughDiagram />
                <p>
                    A skill teaches an agent the format and the rules: edit only what was asked, keep ids, keep valid JSON, do not
                    touch the design, make small targeted edits instead of rewriting the whole file (which wastes tokens), do not rename the file, and ask when unsure. It is
                    generated from the same field tables as the format, so the two cannot drift.
                </p>
                <ul className="list-disc space-y-2 pl-6">
                    <li><a href={SKILL_URL} className="underline">{SKILL_URL}</a>: the full skill.</li>
                    <li><a href={AGENTS_SNIPPET_URL} className="underline">{AGENTS_SNIPPET_URL}</a>: the short version for <code>AGENTS.md</code>, <code>CLAUDE.md</code> or rules files.</li>
                    <li><a href={LLMS_TXT_URL} className="underline">{LLMS_TXT_URL}</a>: an index for tools that read <code>llms.txt</code>.</li>
                </ul>
                <p>
                    In the editor, <em>Use an AI agent on this file</em> shows three steps and copy buttons for the address and a
                    starter prompt.
                </p>
            </LegalSection>

            <LegalSection title="7. Browser support and limits">
                <ul className="list-disc space-y-2 pl-6">
                    <li>Linking needs the File System Access API: Chrome, Edge and other Chromium browsers on desktop. Elsewhere, export, let the agent edit the file, and import it again.</li>
                    <li>The browser does not tell EngineCV a file&apos;s full path; it shows the name and remembers the location itself.</li>
                    <li>Clearing site data removes the link; the file stays.</li>
                    <li>EngineCV never renames your file: a rename through the browser can replace another file in the same folder, which it cannot check. Renaming a linked CV in the app is refused with a message; rename the file in your file manager and relink.</li>
                </ul>
            </LegalSection>

            <LegalSection title="8. Privacy and security">
                <p>
                    The file holds your contact details. Any program that can read the folder can read it, and an AI agent that
                    reads it may send its contents to its model provider. Only use agents you trust with that, and check where
                    the folder is synced (cloud drives copy files). EngineCV asks you to confirm this before the first link. The
                    full statement is in the <Link href="/privacy" className="underline">Privacy Policy</Link>.
                </p>
            </LegalSection>

            <LegalSection title="9. For developers">
                <p>
                    The sync core lives in <code>src/lib/linked-file/</code> and talks only to a small file adapter, so another
                    transport (an MCP bridge, for example) can reuse the reader, the validation and the apply rule. The skill is
                    generated by <code>npm run gen:agent-skill</code> into <code>public/agent/enginecv/</code>. The source is
                    public; see the repository linked from the <Link href="/about" className="underline">About page</Link>.
                </p>
            </LegalSection>
        </LegalPage>
    );
}

import { AlertTriangle, ArrowRight, Bell, Bot, Check, FilePlus, FileText, FolderOpen, Globe, HardDrive, Pencil, ShieldCheck, Undo2, Upload } from "lucide-react";
import { Connector, DiagramFrame, Item, Zone } from "@/components/diagrams/DiagramFrame";

// Editorial diagrams for the "How it works" page. The page is English prose, like the policy pages, so the
// text lives here rather than in the interface dictionaries.

const ok = <Check className="h-3.5 w-3.5 text-success" />;

/** The three parties and what moves between them. */
export function BigPictureDiagram() {
    return (
        <DiagramFrame caption="The big picture" testId="diagram-workspace-big-picture">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/5 px-3 py-1 text-xs font-medium text-success">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                EngineCV uploads nothing. Everything below happens on your computer.
            </p>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch">
                <Zone title="EngineCV in your browser" icon={<Globe className="h-4 w-4" />} testId="diagram-zone-app">
                    <ul className="mt-3 space-y-2">
                        <Item icon={ok}>Your CVs and letters, editor and preview</Item>
                        <Item icon={ok}>Checks every outside change before it applies</Item>
                        <Item icon={ok}>Tells you what happened, with Undo</Item>
                    </ul>
                </Zone>
                <Connector both label="plain files" />
                <Zone title="Your folder" tag="On your computer" tone="accent" icon={<FolderOpen className="h-4 w-4" />} testId="diagram-zone-folder">
                    <ul className="mt-3 space-y-2">
                        <Item icon={ok}>One JSON file per CV and per letter</Item>
                        <Item icon={ok}>Short instructions agents read first</Item>
                        <Item icon={ok}>A place to ask for exports</Item>
                    </ul>
                </Zone>
                <Connector both label="read and write" />
                <Zone title="Agents and tools" tag="Your choice" tone="warn" icon={<Bot className="h-4 w-4" />} testId="diagram-zone-agents">
                    <ul className="mt-3 space-y-2">
                        <Item icon={ok}>Claude Code, Codex, Gemini CLI, OpenCode</Item>
                        <Item icon={ok}>Any text editor</Item>
                        <Item icon={ok}>Git, OneDrive, Dropbox</Item>
                    </ul>
                </Zone>
            </div>
        </DiagramFrame>
    );
}

const TREE = `applications/                 the folder you chose
├─ cvs/
│  └─ Master CV.cv.json       one file per CV
├─ letters/
│  └─ Acme.letter.json        one file per cover letter
├─ exports/                   files EngineCV makes when asked
├─ AGENTS.md                  the short instructions an agent reads first
└─ .enginecv/
   ├─ index.json              what exists, with ids
   ├─ requests/               where an agent asks for an export
   ├─ results/                EngineCV's answer to each request
   ├─ reference/              field and format guides
   └─ log.ndjson              what was accepted or refused`;

/** What is inside the folder. */
export function FolderLayoutDiagram() {
    return (
        <DiagramFrame caption="What is in the folder" testId="diagram-workspace-folder">
            <Zone title="A folder you choose" tag="Plain files" icon={<HardDrive className="h-4 w-4" />}>
                <pre className="mt-3 overflow-x-auto whitespace-pre font-[family-name:var(--font-geist-mono)] text-[11px] leading-5 text-bright sm:text-xs" aria-label="Folder layout">{TREE}</pre>
            </Zone>
        </DiagramFrame>
    );
}

/** What happens to a file an agent (or you) saves. */
export function ChangeJourneyDiagram() {
    return (
        <DiagramFrame caption="When a file is saved" testId="diagram-workspace-journey">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_auto_minmax(0,0.8fr)_auto_minmax(0,1.4fr)] lg:items-stretch">
                <Zone title="A file is saved" icon={<Pencil className="h-4 w-4" />}>
                    <p className="mt-3 text-sm leading-6 text-bright">An agent or an editor writes <code className="font-[family-name:var(--font-geist-mono)] text-xs">Master CV.cv.json</code>.</p>
                </Zone>
                <Connector label="a few seconds" />
                <Zone title="EngineCV checks it" icon={<ShieldCheck className="h-4 w-4" />}>
                    <ul className="mt-3 space-y-2">
                        <Item icon={ok}>Is it complete, valid JSON?</Item>
                        <Item icon={ok}>Does it keep most of what was there?</Item>
                        <Item icon={ok}>Is the letter still a draft?</Item>
                    </ul>
                </Zone>
                <Connector />
                <div className="grid gap-3">
                    <Zone title="Applied" tone="accent" icon={<Check className="h-4 w-4" />} testId="diagram-outcome-applied">
                        <ul className="mt-3 space-y-2">
                            <Item icon={<Undo2 className="h-3.5 w-3.5 text-accent" />}>A restore point is kept first; Undo is one click</Item>
                            <Item icon={<Bell className="h-3.5 w-3.5 text-accent" />}>A notification tells you what changed</Item>
                        </ul>
                    </Zone>
                    <Zone title="Held for review" tone="warn" icon={<AlertTriangle className="h-4 w-4" />} testId="diagram-outcome-review">
                        <p className="mt-3 text-sm leading-6 text-bright">The change would remove most of a CV. Nothing changes until you choose Apply or Keep mine.</p>
                    </Zone>
                    <Zone title="Refused" tone="warn" icon={<AlertTriangle className="h-4 w-4" />} testId="diagram-outcome-refused">
                        <p className="mt-3 text-sm leading-6 text-bright">Invalid, cut-off or too large. Your CV stays as it was, the file is not overwritten, and the reason is shown and written to <code className="font-[family-name:var(--font-geist-mono)] text-xs">.enginecv/results/</code>.</p>
                    </Zone>
                </div>
            </div>
        </DiagramFrame>
    );
}

/** The four things an agent can do. */
export function AgentActionsDiagram() {
    const code = "mt-3 overflow-x-auto rounded-lg bg-surface-1 p-3 font-[family-name:var(--font-geist-mono)] text-[11px] leading-5 text-bright";
    return (
        <DiagramFrame caption="What an agent can do" testId="diagram-workspace-actions">
            <div className="grid gap-3 md:grid-cols-2">
                <Zone title="Edit" icon={<Pencil className="h-4 w-4" />} testId="diagram-action-edit">
                    <p className="mt-3 text-sm leading-6 text-bright">Change a value in a CV or letter file. The app updates by itself; design and photo stay in the app.</p>
                    <pre className={code}>{`"headline": "Product Designer"`}</pre>
                </Zone>
                <Zone title="Create" icon={<FilePlus className="h-4 w-4" />} testId="diagram-action-create">
                    <p className="mt-3 text-sm leading-6 text-bright">Save a new complete file in <code className="font-[family-name:var(--font-geist-mono)] text-xs">cvs/</code> or <code className="font-[family-name:var(--font-geist-mono)] text-xs">letters/</code>. It becomes a new document, with an Open link.</p>
                    <pre className={code}>{`cvs/Specialised Resume.cv.json`}</pre>
                </Zone>
                <Zone title="Export" icon={<Upload className="h-4 w-4" />} testId="diagram-action-export">
                    <p className="mt-3 text-sm leading-6 text-bright">Write a request file. EngineCV makes the export into <code className="font-[family-name:var(--font-geist-mono)] text-xs">exports/</code> and answers in <code className="font-[family-name:var(--font-geist-mono)] text-xs">results/</code>.</p>
                    <pre className={code}>{`{ "id": "a1", "action": "export",\n  "target": "cvs/Master CV.cv.json",\n  "format": "html" }`}</pre>
                </Zone>
                <Zone title="Be noticed" icon={<Bell className="h-4 w-4" />} testId="diagram-action-notice">
                    <p className="mt-3 text-sm leading-6 text-bright">Sign your work and the notification names you. Unsigned changes say &ldquo;a file&rdquo; instead of guessing.</p>
                    <pre className={code}>{`"edited_by": "Claude Code"`}</pre>
                </Zone>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-faint">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                Letters work the same way and follow the CV they name. A letter marked as sent is frozen.
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </p>
        </DiagramFrame>
    );
}

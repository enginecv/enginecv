# Use an AI agent with your CV

EngineCV can keep a CV in a plain JSON file on your computer. A local AI agent (Claude Code, Codex, Gemini CLI, OpenCode, or any tool that edits files) changes the file, and the editor follows. Nothing is uploaded: the link is between your browser and a file on your disk.

## How it works

1. **Link a file.** In the editor header choose *Link to a file*, then *Create a new file* (or *Use an existing file*). The file holds your CV in the `enginecv.authoring/v1` format: content only, no design. While linked, the CV name is the file name. To rename it, rename the file in your file manager and relink; EngineCV never renames files itself, because a rename can replace another file in the same folder and the browser gives no way to check.
2. **Tell your agent.** Install the EngineCV skill (the address is in *Use an AI agent on this file*, or `https://enginecv.app/agent/enginecv/SKILL.md`), then ask it to change the file. For rule-file based agents there is a short version: `https://enginecv.app/agent/enginecv/AGENTS-snippet.md`.
3. **See the result.** When the agent saves the file the editor shows *Updated from file: N added, N removed, N changed*. Each update is preceded by a history snapshot, so you can go back from the history panel.

Edits you make in the editor are written to the file too, so the file is also a backup of your CV.

## What is safe

- A file with a problem (invalid JSON, empty, too large, a full export, a newer format) never changes the CV and is never overwritten. The editor shows the problem with a line and column; fix the file and the CV updates by itself.
- Design, template, photo and signature stay in the app; the file never carries them and an agent cannot change them.
- *Pause* holds both directions. When you resume, the editor tells you which side changed and lets you pick the file or the CV.
- *Unlink* stops syncing and leaves the file and the CV exactly as they are.
- One file can be linked to one CV only.

## Browser support

Linking needs the File System Access API: Chrome, Edge and other Chromium browsers on desktop. In other browsers, use *Copy for your AI* or export, let the agent edit the exported file, then import it again.

## Limits

- Changes are picked up by checking the file about every 1.5 seconds while the tab is visible (2 seconds when idle), and right away when you return to the tab. A hidden tab does not check, and a change is never seen instantly.
- If you rename or move the file outside the app, the link breaks (the editor says so and keeps your CV); relink to the new file.
- If another program holds the file open exclusively, the editor shows *File busy* and retries a few times, then waits for the next change. Your CV is untouched.
- The app cannot show a file's full path (browsers do not expose it); it shows the name and remembers the location itself. A link is kept in the browser's storage, so clearing site data removes it; the file stays.
- The file contains your contact details. An agent that reads it may send its contents to its model provider; only use agents you trust with that. The editor asks you to confirm this the first time you link a file.

## For developers

- The skill and the file format are generated from the same field tables: `npm run gen:agent-skill` rewrites `public/agent/enginecv/`, and a unit test fails when the committed copies are stale.
- The sync core lives in `src/lib/linked-file/` and only talks to a small `FileAdapter`, so another transport (an MCP bridge) can reuse it.
- `scripts/skill-acceptance.md` is the manual acceptance script for the skill.

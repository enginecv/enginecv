# Use an AI agent with your CVs

EngineCV can keep your CVs and cover letters as plain files in a folder on your computer. A local AI agent (Claude Code, Codex, Gemini CLI, OpenCode, or any tool that edits files) changes the files, and EngineCV follows. Nothing is uploaded: the connection is between your browser and a folder on your disk.

## How it works

1. **Connect a folder.** On the dashboard open *Workspace folder* and choose a folder. EngineCV shows what it will write before it writes anything. Each CV becomes `cvs/<name>.cv.json` and each letter `letters/<name>.letter.json`, with instruction files (`AGENTS.md`) and an index an agent reads first. Files hold content only, no design.
2. **Tell your agent.** Install the EngineCV skill (`https://enginecv.app/agent/enginecv/SKILL.md`), open the folder, and ask it to change a file. A new complete file the agent creates becomes a new document.
3. **See the result.** When the agent saves a file the document updates by itself. Every outside change is checked first and a restore point is kept; the activity list shows what was applied or refused and has a one-click undo.

Edits you make in the editor are written to the files too, so the folder is also a backup.

## What is safe

- A file with a problem (invalid JSON, a half-written file, too large, a newer format) never changes the document and is never overwritten. The document shows why; fix the file and it recovers.
- A change that drops most of a section is held for your review instead of applied.
- Design, template, photo and signature stay in the app.
- *Pause* holds both directions. *Disconnect* leaves the files and the documents exactly as they are.
- Optional: leave contact details out of the files.

## Browser support

Connecting a folder needs the File System Access API: Chrome, Edge and other Chromium browsers on desktop. In other browsers use *Copy for your AI* or export, let the agent edit the exported file, then import it again.

## Limits

- Changes are noticed within a few seconds while the tab is visible, and right away when you return to the tab.
- Folders synced by OneDrive, Dropbox or similar work, but the sync tool may hold files briefly or create conflict copies; EngineCV lists those under *Needs a look*.
- The files contain your contact details unless you leave them out. An agent that reads them may send their contents to its model provider; only use agents you trust with that.

## For developers

- The skill and the file format are generated from the same field tables: `npm run gen:agent-skill` rewrites `public/agent/enginecv/`, and a unit test fails when the committed copies are stale.
- The folder code lives in `src/lib/workspace/` and talks to the folder through a small directory adapter, with an in-memory stand-in for tests.
- `scripts/skill-acceptance.md` is the manual acceptance script for the skill.

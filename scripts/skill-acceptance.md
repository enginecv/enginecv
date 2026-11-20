# Agent skill acceptance script

Manual check that the generated skill (`public/agent/enginecv/SKILL.md`) lets a fresh agent session edit a CV file in the workspace folder correctly. Run it after any change to the format or to `src/lib/agent/authoring/skill.ts`, and before announcing the feature.

## Setup

1. In EngineCV (Chromium), open a CV with at least one experience entry, two projects and a skills section. Link it to a new file (`Link to a file`, `Create a new file`).
2. Start a fresh agent session in the folder that holds the file. Install the skill from `https://enginecv.app/agent/enginecv/SKILL.md` (or paste `AGENTS-snippet.md` into the agent's rules file).
3. Tell the agent where the file is.

## Fixed request set

Ask each request in a fresh turn. After each, check the file diff and the editor.

| # | Request | Expected file diff | Expected in the editor |
|---|---------|--------------------|------------------------|
| 1 | "Add a project named Weather Bot: a Telegram bot that sends daily forecasts. Skills: TypeScript, Node." | One new object in `projects` with `name`, `description`, `skills`; no `id` on it; nothing else changed | "Updated from file: 1 added, 0 removed, 0 changed"; project in the preview |
| 2 | "Add Docker to my skills." | One new skill name in the existing group; other groups untouched | "1 added" |
| 3 | "My job at <company> started in March 2021, not 2020." | Only that entry's `start` changes; its `id` is unchanged | "1 changed" |
| 4 | "Remove the second project." | That object is gone; the others keep their ids | "1 removed" |
| 5 | "Make the headings blue and use a different template." | No change to the file; the agent says design is done in the app | No update message |

## Pass criteria

- Every file stays valid JSON and imports with zero errors (check the editor shows no error state).
- No entry other than the requested one changes; ids are kept.
- The agent does not touch `design`, rename the file or invent facts.
- Request 5 is declined with a pointer to the app.

Record the agent, its version, the date and the result of each row here:

| Date | Agent | 1 | 2 | 3 | 4 | 5 |
|------|-------|---|---|---|---|---|
|      |       |   |   |   |   |   |

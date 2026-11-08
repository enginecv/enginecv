# Contributing to EngineCV

Thanks for helping. EngineCV is a small, privacy-first project run by one person, so a short, predictable workflow keeps things moving.

## Workflow: GitHub flow

`master` is the only long-lived branch. It is always releasable, and production is built from it.

1. **Open or find an issue** for anything bigger than a typo. For a large change, say what you plan to do before you build it.
2. **Branch from `master`.** Fork the repo if you are not a collaborator. Use a short, descriptive name such as `fix/pdf-page-break` or `feat/croatian-translation`.
3. **Make small commits** with clear messages. [Conventional Commits](https://www.conventionalcommits.org/) are preferred (`fix(export): ...`, `feat(import): ...`).
4. **Open a pull request into `master`** early. A draft PR is fine. Describe what changed and why, and link the issue.
5. **Get a review.** Run the checks below first. Address feedback by pushing more commits to the same branch.
6. **Squash and merge.** Each PR becomes one commit on `master`, and the branch is deleted afterwards.

There is no `develop` branch and no release branch. Keep branches short-lived and rebase on `master` if yours falls behind.

## Set up

```bash
npm install
npm run dev        # http://localhost:3000
```

Before opening a PR, run:

```bash
npm run lint
npx tsc --noEmit
npm test           # Vitest unit and integration tests
npm run test:e2e   # Playwright (run `npx playwright install chromium` once)
```

Add or update tests for behaviour you change.

## Engineering standards

Pull requests are reviewed against these. A change that breaks one will be asked to fix it before merge.

**Code and data**
- One source of truth. Business rules live in typed, reusable modules under `src/lib`. The editor, preview, storage, templates and exports consume them instead of re-implementing the logic.
- Validate at every boundary. Resume data is checked against the schema (Zod) on import, before it is saved, and before it is exported.

**Tests**
- Pure logic, schema behaviour, translation helpers and data transforms need unit tests.
- Changes to state, IndexedDB persistence, templates or locale handling need integration tests where they are affected.
- Critical flows (creating a resume, editor persistence across reloads, locale switching, template editing, export) need end-to-end coverage.
- A bug fix includes a regression test at the lowest layer that can catch it.

**User experience**
- Every new or changed flow defines its loading, empty, error and success states.
- Destructive actions are explicit, translated and recoverable where possible (confirmation, undo, history, or duplicate-as-new).
- The editor, preview and exports must show the same thing. A difference between them is a bug.

**Performance and offline**
- Typing, live preview, autosave and language switching must stay responsive on an ordinary laptop. Do not block input on exports, image processing or network calls. Move heavy work off the main thread.
- Core editing must keep working with a slow or missing network. Network features degrade gracefully and never risk losing local data.

**Internationalisation**
- All user-facing text goes through the translation layer in `src/lib/i18n/`. Add every new key to all locale files (`en`, `bs`, `de`, `fr`, `es`).
- Layouts must tolerate longer translations. Tests for locale-sensitive changes cover at least one non-English locale.
- Native-speaker review of non-English copy is appreciated.

**Privacy and honesty**
- Local-first. Resume data stays in the browser. Do not add code that sends resume content to a server. Do not add analytics or third-party requests without discussing it first. Anything that leaves the device must be an explicit user action and be disclosed on the privacy page.
- No unverifiable claims. Do not write copy that promises job or ATS outcomes. Describe what a template or feature does, not what an employer's software will do.

**Interface**
- Use the semantic colour tokens, not hard-coded hex values.
- Keep text contrast at WCAG AA and make new controls reachable by keyboard.

## Reporting bugs and ideas

The easiest way is the **Send feedback** button inside the app, which opens a pre-filled issue here and lets you remove any context you do not want to share. You can also open an issue with one of the templates directly. Do not paste real resume content, personal data or secrets into public issues.

## Security

Do not open a public issue for a vulnerability. Use [private vulnerability reporting](https://github.com/enginecv/enginecv/security/advisories/new) instead.

## Licence

By contributing you agree that your contribution is licensed under the [AGPL-3.0](./LICENSE), the same licence as the project.

# EngineCV Roadmap

Long-term plan for making EngineCV a better job-search tool than Teal while preserving the local-first / privacy-first moat.

## Positioning

- **Teal's moat**: job tracker, Chrome extension across 40+ boards, AI rewrites, cover letters, interview prep. Gated behind a $29/mo paywall; all data lives on Teal's servers.
- **EngineCV's moat**: local-only (IndexedDB), no account, no paywall, i18n, embedded-data PDFs, freeform design overlay, in-browser local LLM option.
- **Goal**: close the feature gap on the parts of Teal users actually pay for, without giving up local-first.

## Guiding principles

1. **Local-first by default.** Any new data lands in IndexedDB. Any sync is opt-in and end-to-end encrypted.
2. **BYO API key, foregrounded.** Remote LLMs are allowed but the user supplies the key. Local model (`Xenova/*` via web worker) is the zero-setup fallback.
3. **Composable over monolithic.** Tracker, matcher, tailoring, letter gen must work independently — users adopt them piece by piece.
4. **No backend creep.** Server-side features are a last resort; prefer a browser extension or encrypted blob export.

---

## Phase 1 — Quick wins (reuse existing stack)

Each item is scoped to ~1–3 days and reuses `useAI`, `llm.ts`, Dexie, and the existing editor shell.

1. **JD matcher** — paste a job description, extract keywords, score resume coverage, highlight gaps.
2. **Tailor-to-JD action** — one-click rewrite of summary and selected bullets against a JD.
3. **Cover letter generator** — JD + resume → letter, exported via the existing PDF pipeline.
4. **"Duplicate for job" variants** — per-application resume copies carrying their JD context.

(See "Phase 1 architecture" below for concrete design.)

## Phase 2 — Core parity (1–2 weeks each)

5. **Job application tracker** — new Dexie table `applications` (company, role, status, jdText, resumeId, dates, notes). Kanban + table views. No backend.
6. **BYO-API-key, foregrounded** — surface in onboarding; explicit answer to Teal's credit paywall.
7. **ATS linter** — deterministic rule checks on the rendered resume (multi-column, image-only text, nonstandard section names, date formats, parseable contact block). No AI needed.

## Phase 3 — Bigger bets

8. **Browser extension for job capture** — MV3 extension scraping LinkedIn/Indeed/Greenhouse/Lever into the tracker. Start with a **bookmarklet** (10% effort, 70% of value) before committing to the extension.
9. **Interview prep** — LLM-generated question sets from JD + resume; practice; local storage; lightweight spaced review.
10. **Encrypted export / opt-in sync** — E2EE blob export so users can move between devices without a server seeing plaintext.

## Sequencing

Phase 1 strictly in order — the JD matcher unlocks #2–#4 conceptually and is the most demo-able differentiator. Don't start the extension (#8) until the tracker (#5) exists to receive captured jobs.

## Tradeoffs to revisit

- **Sync vs. privacy** — the moment a server sees plaintext, the pitch weakens. Keep sync encrypted-blob-only.
- **AI cost model** — BYO-key is the cleanest answer to Teal's paywall but raises onboarding friction. Consider a rate-limited shared key for first-run only, or stay BYO-only for purity.
- **Extension scope** — a real multi-board scraper is a product unto itself. Bookmarklet → 1–2 boards → generalize.

---

# Phase 1 architecture

Grounded in the current codebase:

- `useAI` (`src/hooks/useAI.ts`) already exposes `extractKeywords`, `generateAIContent`, `streamAIContent` with local/remote providers.
- `resume.settings.ai` (`src/lib/schema.ts:741`) carries mode/provider/model/localModel.
- `ResumeDatabase` (`src/lib/db.ts`) already has `resumes` + `resumeHistory`; add tables alongside, bump `version()`.
- `AIChat.tsx` and `EditorSidebar.tsx` are the integration points in the editor.

## Data model additions

Add a `jobContext` object to `resumeSchema` (Phase 1) — a first-class `applications` table comes in Phase 2 and will reference it:

```ts
// src/lib/schema.ts
export const jobContextSchema = z.object({
    company: z.string().default(""),
    role: z.string().default(""),
    location: z.string().default(""),
    url: z.string().url().or(z.literal("")).default(""),
    jdText: z.string().default(""),
    // Cached analysis. Recomputed when jdText changes.
    analysis: z.object({
        keywords: z.array(z.object({
            term: z.string(),
            weight: z.number(),           // tf-idf-ish 0..1
            category: z.enum(["skill", "tool", "responsibility", "soft", "other"]),
        })).default([]),
        extractedAt: z.number().default(0),
    }).default({ keywords: [], extractedAt: 0 }),
}).nullable().default(null);

// in resumeSchema:
//   jobContext: jobContextSchema,
```

Rationale: putting `jobContext` on the resume makes "duplicate for job" a pure resume duplication. Phase 2's `applications` table will reference `resumeId` and optionally carry its own `jobContext` snapshot, but Phase 1 doesn't need that split yet.

## 1. JD matcher

**New module**: `src/lib/jd-match.ts`

Responsibilities:

- `extractJdKeywords(jdText: string): Keyword[]` — tokenize, drop stopwords, score by TF + a curated skills dictionary bump (`src/lib/skills-dictionary.ts`, ~1–2k common terms).
- `scoreCoverage(resume: Resume, keywords: Keyword[]): CoverageReport` — flatten resume text (summary, highlights, skills, project keywords), do case-insensitive + stem match, return per-keyword hit/miss + weighted score 0..100.
- `findGaps(report: CoverageReport): Keyword[]` — top N missed by weight.

Purely synchronous, no AI required. Optional enhancement: use the existing worker `extractKeywords` for embedding-based match when a local model is ready, gated behind `settings.ai.mode !== "off"`.

**UI**: new `JDMatcherPanel.tsx` in `src/components/editor/`, mounted in `EditorSidebar`. Left: JD textarea + metadata (company, role, url). Right: score dial, keyword chips (green = covered, red = missing), click-to-copy gaps.

**Persistence**: writes to `resume.jobContext` via the existing Zustand store. No new table.

## 2. Tailor-to-JD action

**Reuses**: `useAI.generateAIContent` + existing `aiHistory` checkpoint flow (`aiCheckpointSchema`).

**New module**: `src/lib/tailor.ts`

- `buildTailorPrompt({ resume, jobContext, target })` where `target ∈ { summary, bullet, section }`. Returns `ChatMessage[]`.
- Prompt constraints: "rewrite using the resume's facts; do not fabricate roles, dates, or metrics; bias toward keywords X, Y, Z".

**UI integration**:

- Inline "Tailor" button next to the summary field and each experience bullet (reuses `EntryForm`).
- On click: call `generateAIContent`, show diff modal (reuse `PhotoCropModal`-style modal shell), accept writes via the store and creates an `aiCheckpoint`.

**Guardrails**: if `resume.jobContext` is null/empty, the button opens the JD matcher panel instead of running.

## 3. Cover letter generator

**New route**: `src/app/cover-letter/[resumeId]/page.tsx` (read-only, previews and exports).

**Logic**: `src/lib/cover-letter.ts`

- `generateCoverLetter({ resume, jobContext, tone, length })` → string. Uses `generateAIContent` with a templated system prompt.
- Stored on the resume as `resume.coverLetters: CoverLetter[]` (new schema field: `{ id, createdAt, jobContextSnapshot, body, tone, length }`).

**Export**: new `cover-letter-pdf.ts` that mirrors `resume-pdf.ts`'s html-to-image → jsPDF approach but with a simpler one-page layout using the resume's typography/color tokens for brand consistency.

**UI**: "Cover letter" entry in `ExportMenu.tsx` + a dedicated panel route.

## 4. "Duplicate for job" variants

**Store action**: extend `store.ts` with `duplicateResumeForJob(sourceId, jobContext) → newId`:

1. Load source resume, deep-clone.
2. Assign new `id`, reset `createdAt`/`updatedAt`, append `"— {company}"` to `meta.title`.
3. Set `jobContext` on the clone.
4. Persist via Dexie, return the new id.

**UI**: "Duplicate for job" button on the dashboard (`src/app/dashboard/`) and in the editor header. Opens a small modal that collects company/role/url + JD paste, creates the clone, navigates to `/editor/[newId]`, and opens the JD matcher panel with analysis already run.

## Cross-cutting work (done once, benefits all four)

- **i18n keys**: add `jd.*`, `tailor.*`, `coverLetter.*` key sets across `src/lib/i18n/{en,bs,de,fr,es}.ts`.
- **AI provider UX polish**: surface the current provider + "using your own API key" badge in every AI-triggering control. Failing AI calls should fall back to showing the prompt text so users can run it in their own tool.
- **Tests**: Vitest for `jd-match.ts` (deterministic, easy), `tailor.ts` prompt shape, and `duplicateResumeForJob`. Playwright smoke: paste JD → see score → click Tailor → see diff modal.

## Order of implementation within Phase 1

1. Schema additions (`jobContextSchema`, `coverLetters`) + Dexie version bump.
2. `jd-match.ts` + skills dictionary + unit tests.
3. `JDMatcherPanel` in the editor sidebar.
4. `duplicateResumeForJob` + dashboard/editor entry points.
5. `tailor.ts` + inline "Tailor" buttons + diff modal.
6. Cover letter generator + route + export.
7. i18n, Playwright smoke, docs.

Steps 1–3 give the first demo-able win; 4–7 layer on without rework.

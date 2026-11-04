# Job feed notes

## 2026-11-04: Stage 0, reading the repo

- Cloned `patsypppe/auto-applier` into `Desktop/Projects/auto-applier` and created the local branch `job-feed` from `main` at `1ba243a`. Nothing committed or pushed.
- Baseline: `npm ci`, then `npm test` (core 691 passed, extension 228 passed) and `npm run typecheck` (clean).
- Summary of the repo is in `docs/REPO_SUMMARY.md`.
- Open questions for Pranjal: the comment rule in the root design notes, the lockfile, and where the feed runs (see the Stage 0 reply).
- Next: Stage 1 research, after approval.

## 2026-11-04: Stage 1, research

- Stage 0 approved. The three Stage 0 questions are still open and are repeated at the end of `docs/RESEARCH.md`.
- Test calls: Greenhouse, Lever, Ashby, SmartRecruiters, Workday, Recruitee and Workable all answered without a key. Greenhouse, Lever, Ashby and SmartRecruiters send `Access-Control-Allow-Origin: *`; Workday's preflight returns 404.
- Scanned 12,802 postings from 80 boards for work-authorization wording. Almost none mention it outside defense and space. No posting said OPT welcome or offered sponsorship. Hand-checked 60: 55 right, 5 wrong.
- Decision proposed: a "not stated" tag separate from "unclear", because silence is the common case.
- Dead ends: Reddit cannot be fetched with my tools. USCIS, e-verify.gov, eCFR and dol.gov block `curl`, so those pages were read in a browser. Simplify's `sponsorship` field is set on only 27 active listings, too few to use.
- Accidental: opening the DOL record layout PDF in the browser pane triggered a save dialog. The file was then read in-page instead.
- Next: Stage 2 spec, after approval and answers to the open questions.

## 2026-11-04: Stage 2, spec

- Stage 1 approved with option A: a Node command plus a local page, with the profile in a gitignored `data/profile.json`.
- Wrote `docs/SPEC.md`: two example users, features F1 to F11 with checks, settings, non-goals, and success targets.
- Decisions in the spec: filters hide but never delete, and the header counts what is hidden. H-1B history sits beside the posting tags and never becomes one. The research appendix's 60 postings become a test fixture.
- Still open: DOL and USCIS downloads, comment style, dependencies (`pdfjs-dist` for PDF resumes), and the status list.
- Next: Stage 3 plan, after approval.

## 2026-11-04: Stage 3, plan

- Stage 2 approved.
- Checked that a `packages/jobs/package.json` with no `npm install` works: workspace scripts run, vitest, esbuild and `@auto-applier/core` resolve from the root, the lockfile stays unchanged, and root tests still pass. The test file was removed afterwards.
- Wrote `docs/PLAN.md` (layout, shapes, collecting, tags, matching, history, page, tests, merge plan, 10 slices) and `docs/INTEGRATION.md`.
- Proposed changes to the spec: USCIS H-1B data before DOL (CSV instead of a 252 MB Excel file), `getJobs` taking plain data instead of a store, and PDF resumes waiting on the dependency decision.
- Next: slice 1, after approval and an answer on comment style.

## 2026-11-04: Slice 1, package and Greenhouse

- Plan approved, with the friend's comment style (one line at the top of each file and above each function).
- Committed the docs first.
- Added the package: `package.json`, `tsconfig.json`, `build.mjs` (esbuild bundles `src/cli.ts`), `.gitignore` (`data/`, `dist/`).
- Found: with the new workspace and an unchanged lockfile, `npm ci` fails ("Missing: @auto-applier/jobs@0.1.0 from lock file"). `npm install` works but adds the workspace to the lockfile. Written in `docs/INTEGRATION.md`; needs a decision.
- Built `fetchJson` (fixed user agent, 30 s timeout, retries after 1, 3 and 9 s on 429 and 5xx or a dropped connection), `htmlToText`, `countryOf`, `fetchGreenhouseBoard`, and `collect --board greenhouse:<slug>`.
- Real runs: stripe 758 jobs in 0.6 s, airbnb 207 in 0.3 s, databricks 927 in 1.5 s. The first version left 352 of Stripe's jobs without a country, because Stripe writes bare city names. Reading the offices too brought that to 3 (Bucharest, Barcelona). Hand-checked 20 random Databricks jobs: all 20 countries right.
- Next: slice 2, Lever and Ashby, the three sources at once, the pause between requests, the cache and the run summary.

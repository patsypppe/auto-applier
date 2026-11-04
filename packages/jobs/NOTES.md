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

## 2026-11-04: Slice 2, Lever, Ashby, pauses and cache

- The lockfile question is still open; left as written in `docs/INTEGRATION.md`.
- Each job site is now a `BoardSource`: `fetchRaw` (the requests) and `readJobs` (the answer to records), so the cache can store raw answers and re-read them after a code change. Greenhouse was split the same way.
- Lever: the country comes from Lever's two-letter code, because "CA" there means Canada. Ashby: unlisted jobs are skipped, and the country is read from the address fields as well as the location text.
- `collectBoards` reads one site's boards in order. Every request after the first waits the pause (1 s default), so Workday's several requests per board will be paced the same way. `collectAll` runs the sites side by side. A failed board is recorded and the run goes on.
- Cache: `data/cache/<site>/<slug>.json` with the fetch time; 12 hours, `--fresh` skips reading it.
- Real runs: 7 boards (stripe, airbnb, spotify, palantir, plaid, ramp, notion) in 4.4 s: 1,676 jobs, plaid's 404 reported. A second run of three boards came from the cache in 0.2 s. All 711 Lever and Ashby jobs got a country. Hand-checked 16 random jobs across the three sites: all right.
- Fixed: the slice 1 entity test had a literal em dash in it; it now uses escapes and a degree sign.
- Company names from Lever and Ashby are the slug ("spotify", "ramp") until the company list in slice 3 gives real names.
- Next: slice 3, the company list and a full collection.

## 2026-11-04: Slice 3, company list and a full collection

- Found while studying real links: Greenhouse's EU boards (`job-boards.eu.greenhouse.io`) answer on the normal API, but Lever's EU boards only answer on `api.eu.lever.co`, so boards carry an optional `region: "eu"`. Embedded Greenhouse links name the board in `?for=`; links with only `?token=` name no board. The Stage 1 slug count had wrongly taken "embed" as a slug.
- `companies`: Simplify new-grad gave 1,280 boards and internships 1,085, merged to 1,931 (Greenhouse 863, Lever 341, Ashby 727). About 30,600 links point at other job sites.
- Decision: the aggregator's lists (about 16,000 slugs, mostly not tech) are opt-in with `--with-aggregator`. At about one board a second per site they would add hours to every run.
- Decision: jobs are saved as `data/jobs.jsonl`, one per line. The full run's descriptions alone are 541 million characters, close to what one JavaScript string can hold.
- Request errors now carry the HTTP status, so 404s are told apart from busy servers. A board that returns 404 on two different days is skipped by later runs.
- Full run from an empty cache: 1,022 s (17 minutes), 98,179 jobs, peak memory 1.4 GB, cache 1.2 GB, jobs file 597 MB.
  - Failures: 96 boards, all 404 (Greenhouse 40, Ashby 30, Lever 26). No 429, timeout or 5xx.
  - Politeness from `data/requests.log`: never more than 1 request per second per host. Smallest gap 1.02 s, median about 1.1 s.
  - Largest boards: Lever tsmg 4,475 jobs, Greenhouse prolificacademicltd 4,160, SpaceX 2,893.
- Country: first run left 9.1% undecided. Most were "Remote" alone (4,943, of which 3,929 are from prolificacademicltd, a paid-study site). Added big city names and state codes without a comma ("Atlanta GA"), test first. Now US 65,314, other 25,818, undecided 7,047 (7.2%). A 30-job sample looked right, except Cloudflare's "Distributed", which was read as other from its office data and could not be confirmed.
- A rerun from the cache took 67 s; only the 96 boards that had failed were asked again.
- Not done yet: companies like prolificacademicltd (paid studies) and eosfitness (gym jobs) are in Simplify's list. Filtering by job title in the matching slice should hide them.
- Next: slice 4, merging repeat postings across cities and across runs.

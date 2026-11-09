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

## 2026-11-04: Slice 4, copies and reposts

- Measured first, on the full run: 9,855 postings were exact copies (same board, title and text) in another city. Ignoring the job's own city names and all numbers in the text raised that to 10,360. Copies that differ in a real way stay apart: SpaceX's Bastrop copy has no pay range, and Deepgram's Singapore copy adds "This role does not sponsor Employment Pass". Both pairs are in the fixture.
- `textHash`: sha256 of board, title (lowercase, spaces squashed) and text with the job's own place words and numbers taken out.
- `mergeCopies`: one job per hash, keyed by the lowest id (numeric order), so the key stays the same from run to run. Locations combined; US if any copy is in the US; earliest posting date, latest update.
- `linkReposts`: `data/seen.json` remembers each job's hash and first-seen date for 60 days. A known key keeps its first-seen date. A new key with a remembered hash gets `repostOf` (the oldest copy) and that copy's first-seen date. Lookup is by hash, built once per run, because the first version searched every remembered job for each new one.
- Real data, from the cache: 98,179 postings became 87,820 jobs. A second run kept all 87,820 keys and first-seen dates, with 0 reposts, as expected on the same day. Hand-checked 15 jobs with several locations: all are genuinely one posting.
- Not tested on real data: reposts, which need runs on different days. Only the fixture tests cover them.
- Known limit: numbers are ignored, so copies whose pay range differs by city are joined, and the job shows one copy's range.
- A test mistake caught along the way: changing a copy's location in a test left the old city in its text, so the copies no longer matched. The test was fixed, not the code.
- Next: slice 5, work-authorization tags.

## 2026-11-04: Slice 4b, review fixes (in progress)

- An independent two-reviewer review (kept outside the repo) confirmed two serious problems: joining hid real separate openings and their links (F2), and a run during an outage empties the feed (F1). It also found medium issues: F3 (`--board` replaces the feed), F4 (the timeout covers headers only), F5 (`Retry-After` is ignored), F6 (", IN" and ", DE" read as US states), F7 (writes are not atomic), F8 (the data folder follows the current directory). The docs have drifted in about 14 places.
- Done, test first:
  - F2: the text hash now ignores only dates (ISO, slash dates, bare years), so pay and years of experience keep openings apart. Copies at the same place are never joined. A joined job lists every copy's id, link and places in `copies`. The real Anduril pair (5010190007 and 5010389007, same city, "2+" vs "5+" years) is a fixture and stays apart.
  - Reposts: a job is linked as a repost only when its earlier copy is no longer listed. The first run after the F2 fix wrongly linked 35 same-day jobs whose "earlier copy" was still live.
- Real data from the cache, after F2: 98,179 postings became 90,254 jobs (was 87,820). 2,179 joined jobs hold 10,104 copies, and each copy keeps its own link. Anduril's DC opening 5215557007 is kept as a copy with its own link.
- Clean-up: `data/seen.json` was restored from the copy taken before this slice. `data/jobs.jsonl` still has the 35 wrong repost marks until the next run.
- A rerun to confirm the repost fix on real data was stopped from outside (exit 137) before it wrote anything. Not rerun.
- Left for slice 4b: F1/F7 (keep the old feed when most boards fail, atomic writes), F3, F4, F5, F6, F8, F9, the doc drift list, and the README's 597 MB figure (549 MB, and now about 564 MB with the copies lists).
- Rest of slice 4b, test first:
  - F1/F7: `writeJobsFile` and `writeJsonFile` write to a `.tmp` file and rename it when complete. A site that cannot be reached for 5 boards in a row is skipped for the rest of the run. `brokenRunReason` stops the run with an error, keeping the earlier feed, when no board worked or more than half failed for reasons other than 404.
  - F3: `--board` writes `jobs.boards.jsonl` and does not touch `seen.json`.
  - F8: the data folder is found from the built file's location, so a run from the repo root still writes to `packages/jobs/data`.
  - F9: request-log lines are collected during the run and written once, awaited.
  - F4: the timeout now covers reading the body (an endless body times out). F5: a `Retry-After` in seconds or as a date is honored, up to a minute.
  - F6: codes that are both a state and a country (IN, DE, IL, CA, CO, AR, PA, MA, ID) next to a known city abroad read as abroad; "Paris, TX" and "Indianapolis, IN" stay US.
  - `collect` now has tests, using a fake network. The first failing test runs, before `runCollect` took a fake network, sent about 12 real requests to Greenhouse for the made-up boards acme, globex and initech. That can't happen now.
- Found on the real rerun: F12 was worse than the review rated it. All 96 boards that returned 404 were skipped as "dead on two different days" after only a few hours, because the days were UTC dates and 4 pm in California is already the next day in UTC. Fixed: dead means two 404s at least 20 hours apart, using times. `data/dead-boards.json` was reset to one 404 per board, at the time of the first full run (2026-11-04 about 23:09 UTC, approximate).
- Real rerun from the cache after all fixes: 98,179 postings became 90,254 jobs (60,311 US, 23,303 other, 6,640 undecided), 2,179 joined jobs, 0 repost marks, no `.tmp` files left. It took 19 s, but that run skipped the 96 boards it wrongly thought dead.
- Docs: SPEC and PLAN brought in line with what was built (jobs.jsonl, USCIS first, retries and timeout, aggregator opt-in, hashing rule, dead-board file, request log, user agent). RESEARCH: Lever's CORS header vs its README, appendix #22 (a U.S. person rule) and #43 (Public Trust is not a clearance) corrected, so the count is 53 right and 7 wrong. README numbers and limits updated.
- Not done in 4b: Lever US and EU boards with the same slug still share a cache file (F10, low); invalid numeric entities can throw (F11, low); Lever slugs are not URL-decoded (F13, low). Reposts are still tested only with fixtures.
- Next: slice 5, work-authorization tags.

## 2026-11-04: Slice 5, work-authorization tags

- Built test first:
  - `splitSentences`: does not break at U.S., U.S.C., Inc., e.g. and similar; every line is its own sentence.
  - `rules.ts`: the phrase rules as data.
  - `tagJob`: one tag of each kind, with the evidence sentence and its neighbours. Rules check each semicolon part, so a hedge in one part does not cancel a firm rule in another. Jobs abroad get no restriction tags, and sentences naming only another country are skipped.
  - `effects.ts`: the status-by-tag table, plus `jobEffect` (worst wins; a plus only when nothing is worse).
  - `tags` command: counts, effects for one status, and `data/tag-check.json`, a fixed sample of 50 tagged and 50 random jobs.
- Fixture: the 60 research-appendix postings with their full text from today's data, and the corrected expectations (#22 U.S. person, #43 Public Trust is unclear). My first fixture script matched all Databricks rows to one Tokyo job, because their links differ only in `gh_jid`; #29, #31 and #32 had passed only by luck. Rebuilt matching on job ids.
- Found while running on real data: Node's `readline` splits lines at U+2028, which `JSON.stringify` leaves unescaped and which appears 116 times in real descriptions. `eachJob` now splits only at "\n". This would have broken the feed page too.
- Hand check (spec targets: restriction precision at least 95%, recall at least 90%, not-stated at least 95%):
  - 50 tagged jobs: 47 restriction tags, 2 wrong (95.7%). Wrong: "citizenship may be required for some positions", and "must disclose any current or future need for sponsorship". Both fixed. Missed: "Must be US Citizenship", "US Government clearance (requires US citizenship)", plural "security clearances", and Anthropic's "We do sponsor visas!". All fixed, each with a test made from the real sentence.
  - 50 random jobs: about 16 had a restriction and none was missed. 25 of 26 "not stated" really say nothing; Relativity's "background check ... to obtain clearance for on-site work" should be unclear (not fixed). Two missed sponsorship offers and one false unclear (a skill line) were fixed.
  - A re-check after the fixes was not done on a fresh sample, so the figures above are from before the fixes.
- Real feed, 66,951 jobs in the US or with no country: not-stated 44,635; us-person 7,127; clearance 6,990; unclear 5,784; no-sponsorship 3,274; e-verify 3,163; citizen-only 1,555; no-future-sponsorship 1,220; sponsors 1,050; opt-cpt-welcome 72. The research sample found no sponsorship offers in 12,802 postings, but the full feed has 1,050 (Anthropic's note on its postings is most of them; the 20 checked were all real).
- Effects by status: F-1 OPT: blocked 13,898, likely blocked 2,839, ok 46,783, plus 3,431. Citizen who can obtain a clearance: nothing blocked. Permanent resident: blocked 1,555, likely blocked 5,926. H-1B: blocked 16,737.
- Known limits:
  - "does not provide sponsorship of any kind, including CPT, OPT" is tagged no-sponsorship, which a CPT intern with no later need reads as ok.
  - Unclear sentences such as headings ("EXPORT CONTROL REQUIREMENTS") add an unclear tag next to the real one. That is harmless, since the worst effect wins.
  - Permanent residents and clearances are still unverified (Executive Order 12968 not read).
- Next: slice 6, settings, profile and matching, `getJobs` and `applyFilters`.

## 2026-11-04: Slice 6, settings, profile and matching

- Built test first:
  - `settings.ts`: reads `data/settings.json`. Defaults depend on the status (students and visa holders need sponsorship later; citizens can obtain a clearance), and every mistake is listed with the field name and what is allowed.
  - `profile.ts`: reads `data/profile.json` and checks it with the core's `validateProfile`, one problem per line.
  - `matching/`: `findSkills` (about 120 hand-listed skills with aliases; "R", "C", "Go" and "Julia" count only with another language in the same sentence; Spark, Excel, Git and others need their capital letter), `levelFromTitle`, and `scoreMatch` (70 times the share of the job's named skills the user has, plus 30 for a wanted title).
  - `getJobs` ranks every job (score, then newest).
  - `applyFilters` hides by the first reason (abroad, blocked, likely-blocked, role, title-word, level, location, remote, old, company, score), and shown plus hidden always equals the total.
  - `top` command; `src/index.ts`; `data.example/` with settings, a made-up profile and an extra-companies file.
- Changes to the plan:
  - `getJobs(settings, profile, jobs)` takes the job list directly; applied history and H-1B data join it in their own slices.
  - The skill list is written by hand rather than taken from O*NET, which would be a new download; O*NET can replace or extend it later.
  - `includeAbroad` replaces the spec's `countries` list, since the feed only knows US, other and undecided.
- Real run with the made-up example profile (MS Statistics, F-1 OPT with a STEM degree, roles data scientist, data analyst, machine learning engineer, data engineer): 99 of 90,254 shown. Hidden: role 52,287, abroad 23,303, blocked 13,898, title-word 323, old 264, level 80. 74 s, 1.2 GB peak memory.
- Of the 561 US data-role jobs without senior words in the title, 462 were hidden: 264 as older than 30 days (Greenhouse dates a job from its first publication, and many stay open for months), 158 blocked (mostly federal contractors: Accenture Federal 32, Agile Defense 18, GRVTY 15, CGS Federal 10, SpaceX 8), and 40 by level.
- Match quality, judged by me against the made-up profile, not by Pranjal: all of the top 20 are data roles. Several (OpenAI's) probably expect years of experience that the title does not state.
- Known problems:
  - A job that names only one known skill scores 100 if the user has it (Vestwell, Fanatics), so few-skill jobs outrank detailed ones.
  - Years of experience ("5+ years") are not read yet.
  - Tagging and skill-finding all 90k jobs takes about a minute.
- Next: slice 7, the feed page and applied history.
- Decision (Pranjal, after the first real run): `postedWithinDays` defaults to 90 instead of 30. With the example profile, shown jobs went from 99 to 220, and "old" from 264 to 143.
- New in the top 25 after that change: Integra FEC lists the same internships on two boards ("Integra FEC" and "Integra FEC - Internships"), so they appear twice, because copies are only joined within one board. Also, "Data Scientist (3-5 years experience)" ranks 25th, more reason to read years of experience.

## 2026-11-04: Slice 6b, scoring fixes

- Pranjal chose to fix scoring before the feed page.
- Score: at least three skills count in the share (70 x matched / max(named, 3)), so a posting that names one skill the user has scores 53, not 100. Test first.
- Years of experience: `yearsRequired` reads "3+ years", "3-5 years", "at least 2 years", "a minimum of 4 years'" and "2+ years in a role", and needs a word like experience, role or industry nearby, so "for over 20 years" and "18 years of age" do not count. It takes the largest requirement, leaving out sentences marked preferred, nice to have or a plus. New setting `filters.maxYearsRequired` (default 2) and hide reason "experience". The yearsRequired tests and code were written in one step, not run red first.
- Copies on two boards: `joinAcrossBoards` folds a posting with the same title and text (at least 300 characters) from a second board of the company into the first board's job, by name, when they are listed at the same places, keeping every link in `copies`. The first try left Integra FEC's copies apart, because one board's text had an extra colon. The comparison now ignores punctuation too; pay ranges still differ as numbers.
- Real data from the cache: 98,179 postings became 89,927 jobs (was 90,254). With the example profile, 146 shown. Hidden: experience 124, role 52,065, abroad 23,211, blocked 13,893, old 88, level 80, title-word 320. Integra FEC now shows its 4 different internships once each.
- Not checked: how often `yearsRequired` is wrong on real postings. A hand check of 30 or more is the next measurement.
- Next: slice 7, the feed page and applied history.

## 2026-11-04: Slice 7, feed page and applied history

- Built test first:
  - `feed/applied.ts`: statuses saved, applied, interviewing, offer and rejected, each change dated; "none" removes the job; notes kept.
  - `server/serveFeed.ts`: node:http on 127.0.0.1 only. Routes: `/`, `/page.js`, `GET /api/feed` (shown cards, hidden counts, `?show=<reason>` for up to 300 hidden cards, the history) and `POST /api/applied` (checked; a job in the history but no longer listed can still be updated). Cards leave out the description.
  - `page/renderCard.ts`: text only through `textContent`; links only to http(s), so a `javascript:` link does nothing; tags as `<details>` chips with the evidence and context; a status menu with "since" date; other copies' links.
  - `page/filterCards.ts`: search, work-authorization effect, status, and sort by score or date. `page/page.ts` and `index.html` (light and dark) are not unit-tested and were checked in the browser.
  - `export-applied` writes `data/applied.csv`, quoting cells and putting a ' before cells that start with = + - @, so a spreadsheet does not run them.
- Checked in the built-in browser on the real feed (example profile):
  - 146 cards shown; the summary buttons work.
  - Opening a "no sponsorship" chip shows its sentences.
  - Setting a status saved it to `data/applied.json` and listed it under "Your applications".
  - "blocked" listed 300 greyed cards, the first an Accenture Federal TS/SCI job.
  - Searching "intern" left 24 cards.
  - No `<img>` came from job text.
  - The test status was removed afterwards through the API.
- Found in the browser: status dates showed the UTC day, which is already tomorrow on a California evening. They now use the local date (test run with TZ=America/Los_Angeles).
- Known limits:
  - Ranking happens once when `feed` starts (about a minute for the full list), so a new `collect` needs a restart.
  - Changing a status redraws the cards, which closes any open tag.
  - Copies on another board show only their places, not the board's name.
  - `confirm()` before clearing a status could not be checked through the browser tools.
- Next: slice 8, H-1B history from the USCIS Data Hub (needs Pranjal's OK to download). Measuring how accurate `yearsRequired` is would also be good.

## 2026-11-04: Slice 8, H-1B history from USCIS

- Download (approved by Pranjal):
  - USCIS's archive page of CSV files stops at FY2023 and is marked out of date. The current Hub is a Tableau dashboard served from bigdataanalyticspub-sb.uscis.dhs.gov, so I read its sheet names from the embedded viz.
  - "H1B-Employer Data Hub" gives only the top 100. "H1B Public" (`/views/H1BEmployerDataHub-Final/H1BPublic.csv`) gives the full crosstab: 100,283,127 bytes, 785,664 rows, all FY2026, 57,674 employer names, 12 measures per employer location. Saved as `data/h1b/h1b-employers-fy2026.csv`.
  - Approvals added up by name match the dashboard (Amazon 12,010, Google 6,163).
- Built test first: `normalizeName`, `readH1bCsv` (streams the file; joins names that normalize the same, such as STRIPE LLC and STRIPE INC, giving 340; shows the name with the most approvals) and `matchEmployer` (alias, then exact, then a filing name that only adds generic words like Labs, AI or Opco; anything else ambiguous or none). Also the `h1b` command (its test was written after the code), `loadHistory`, the history on cards and in `top`, and `data.example/aliases.example.json` (SpaceX, Ramp, checked in the file).
- Measured on 1,678 companies with US jobs:
  - First version: 690 matched (41%).
  - Hand check of 50 matches: the 30 exact looked right (Cartesian uncertain), but about 4 of the 20 similar-name matches were wrong (Klarity to KLARITY HEALTH, STR to STR GROUP USA, Pico to PICO SERVICES, Relay to RELAY ROBOTICS).
  - Of 30 non-matches, one was clearly missed (Osmo files as "OSMO LABS PBC DBA OSMO"); the rest had no similar USCIS name.
- Fixes, test first:
  - The legal name before "DBA" is used.
  - Names under 5 letters are never matched by a similar name, only marked ambiguous.
  - Similar-name matches say "Matched by a similar name, so check it is the same company."
  - The ambiguous wording now fits a single candidate.
- After the fixes: 668 matched (40%) = 546 exact, 120 similar name, 2 alias. 25 or more are ambiguous and 963 have no filings found under their name.
  - A fresh sample of 19 similar-name matches had 2 or 3 doubtful (Relay, Paradigm to PARADIGM HEALTH, Realm to REALM LABS).
  - My estimate is about 95% of all matches right, but the similar-name ones only about 85 to 90%, which is why they are flagged.
  - "No filings found" is not proof a company never sponsors: many are small startups, some file under another legal name.
- Feed page with history (example profile): of 146 shown, 48 exact, 20 similar name, 6 ambiguous, 72 none. Checked in the browser.
- Next: slice 9, Workday. Still to measure: yearsRequired accuracy.

## 2026-11-04: Slice 9, Workday

- Studied real answers first (Adobe): a search POST returns 20 postings a page with title, externalPath, locationsText and postedOn. The total comes only on the first page; page 2 says 0. A detail GET returns jobPostingInfo with id, jobDescription (HTML), location, additionalLocations, startDate, externalUrl and country.
- Search matches descriptions too ("data scientist" also found "Enterprise Architect"), so details are fetched only for titles that hold a wanted role.
- Built test first:
  - Workday links in Simplify's listings become `tenant|wdN|site` boards (the optional /en-US/ part is skipped; myworkdaysite.com links are not read yet).
  - `workday` source: one search per role, up to 10 pages each, deduped by path, details for matching titles only.
  - `collect` skips Workday unless `--with-workday`, and then needs roles in `data/settings.json`.
  - `titleHasRole` is now exported from `scoreMatch` so both use the same rule.
- Company list with Workday: 3,575 boards (Greenhouse 863, Lever 340, Ashby 726, Workday 1,646).
- Trial on 20 random Workday boards with the example roles (data scientist, data analyst, machine learning engineer, data engineer): 237 requests in 392 s, about 20 s a board, 42 jobs (17 US, 25 abroad), each with a description. Kyndryl, Abbott and Salesforce gave most of them.
- At that pace all 1,646 Workday boards would take about 9 hours, one request a second. Combining roles in one search does not help: on Adobe, "data scientist" finds 23, "data analyst" 77, "data scientist data analyst" 7 and the OR form 13.
- Open: speed. Workday tenants sit on clusters (wd1, wd5 and so on), so one queue per cluster would cut the time several-fold while keeping one request at a time per host. Needs Pranjal's decision.
- Not done: myworkdaysite.com links; cached Workday answers depend on the roles at the time, so changing roles needs --fresh.
- Decision (Pranjal said "do what's best"): no parallel Workday requests, since that would load Workday's shared servers beyond one request at a time. Instead the reader skips detail requests for postings listed abroad (unless `includeAbroad`) and for titles with a left-out word (Senior, Staff and so on), and Workday stays opt-in.
- Same 20 boards again: 217 requests (was 237) in 383 s (was 392), 22 jobs (10 US). All 23 skipped role postings were checked: each was listed abroad or had a left-out word, so the feed would have hidden it. The gain is small because searches are most of the requests. A full Workday run is still several hours, so it suits an overnight run or `--board` for a few companies.

## 2026-11-05: Slice 11a, pay, job type and workplace

- Checked the cached answers first: Ashby sends pay only when asked with `?includeCompensation=true` (the Ramp fixture was saved that way, but the collector never asked), and Lever sends a structured `salaryRange` on 6,802 of 19,271 postings, which was not known when the plan was written. Greenhouse has no such fields.
- Built test first:
  - `JobRecord` gains optional `pay`, `jobType` and `workplace`, set only when the board says so.
  - Ashby: asks with `includeCompensation=true`; reads the Salary component paid "1 YEAR" or "1 HOUR" (10,296 and 498 components in the cache; "1 MONTH", "1 WEEK", "1 DAY" and "1 TIME" are left out), `employmentType` and `workplaceType`.
  - Lever: `salaryRange` paid per year or per hour (the other intervals are left out), `workplaceType`, and the free-text commitment read by its words ("Contract Full time" is contract, "Full time or Part time" is neither, "CDI" and "Remote" are no job type).
  - `readPay(text)` for every job without board pay, read when ranking like the years: "$95,000 - $115,000", "$120K-$150K", "$22.00 - $25.00 per hour", "$219,800&mdash;$274,700 USD", "$174,000 USD - $206,000 USD", "$200,000 - 225,000". It spans every level or place listed. Not pay: millions and billions, ranges just after equity, bonus, stipend or relocation, and ranges per month, week or day.
  - Pay in US dollars from a board or the text must look like pay (yearly 10,000 to 2,000,000, hourly 5 to 500), so a $5,500 to $7,500 internship stipend Stand Together's board marks as yearly is left out.
  - The card shows "Full-time, hybrid · Pay: $381,000 to $510,000 a year".
- Real data: Ashby re-read with pay, 726 requests in 774 s, no more than one a second per host (smallest gaps: Ashby 1.020 s, Lever 1.038 s, Greenhouse 1.055 s). 89,784 jobs.
- Of 59,901 US jobs: pay from the board 13,904, from the text 25,588, none 20,409. Job type known for 23,989, workplace for 22,626 (Ashby and Lever only).
- Hand checks:
  - 40 data and engineering jobs with a dollar amount: first pass 23 of 33 with stated pay right. The misses were "&mdash;" between amounts (7), "USD" after each amount (1) and a second amount without "$" (1), all fixed with tests; then 31 of 33. Left: Braze's base and on-target ranges are joined into one, and Welo's single "$34/hour" is not a range. Funding, bonuses, stipends and a "$124 trillion" line were never read as pay.
  - 40 random text-only readings over all US jobs: all 40 are the stated range; 2 span both base and on-target pay because the posting lists both.
  - 1,479 jobs have pay from both the board and the text: 1,214 agree within 1%. The board wins. Many of the rest are a different level or place in the text.
  - 25 unusual readings: one was wrong ("New hire equity: $16,000-$24,000"), fixed with a test. Ranges such as "$12,600&mdash;$167,000" are what the postings say.
- Test order: the monthly-pay and too-small-stipend tests were run failing before their fix; the equity and relocation tests were written in the same step as their fix, after the real data showed the problem.

## 2026-11-05: Slice 11b, degree

- Studied 30 real degree lines first (6,049 of the 9,847 US data and engineering jobs name a degree). Postings often list "Bachelor's" under the requirements and "MS or PhD" under a "Preferred qualifications" heading, with no "preferred" in the line itself.
- Built test first: `degreeRequired(text, title)` returns `associate`, `bachelor`, `master` or `phd`:
  - The lowest degree the posting asks for, since a higher one is usually a plus. A degree in the title ("Data Scientist Intern - PhD") decides.
  - Left out: degrees marked preferred in their own phrase ("Master's preferred", "PhD (preferred) or Master's", "Highly recommended:"), lines under a preferred heading (until the next requirements heading or a "Minimum education:" line), and sentences that name a degree without asking ("You don't need: a PhD", "typical but not required", founder and company lines).
  - When experience can stand in for the same or a lower degree ("Bachelor's degree or an equivalent combination", "PhD (or BS/MS degree with equivalent level of experience)"), nothing is required.
  - "MS", "BS", "BA" and "PhD" count only in a degree context, so "MS Office", "PHD filters", "a Stanford PhD spinout", "PhD-level researchers" and "MS" in a list of state codes do not.
- `filters.myDegree` (unset by default, so nothing is hidden). A job needing more gets the hide reason `degree`. The card says "Needs a PhD". The example settings (MS Statistics) and the local `data/settings.json` now say `"myDegree": "master"`.
- Hand checks, each a fresh random sample of 40:
  - Mixed jobs: right apart from 3 misses (one fixed: "The ideal candidate will have:" was taken for a preferred heading; two were right by the rule, "Desired Qualifications" and "or equivalent expertise").
  - Read as PhD (these are what a master's student would lose): 27 of 40 right on the first sample; 29 of 40 on a second sample, with new wordings; 37 of 40 on a third; 38 of 40 on a fourth. Every miss was fixed with a test from the real line.
  - Read as master's: 33 of 40 right; the 7 wrong ("undergraduate or Masters", "master/reference data", "a master of Python", two "Highly recommended" lines and two lists of state codes with "MS" for Mississippi) were fixed with tests.
  - Read as bachelor's: 37 of the 38 printed right; the one miss is "a BS ... or the equivalent", which is not yet seen as experience standing in. It only matters for an associate's-degree user, so it is left as a known limit.
  - Read as associate's: the readings match the postings (defense contractors' "Associate's degree plus 10 years, or Bachelor's plus 8 ..." tiers).
- Over the 9,847 jobs: PhD 142, master's 341, bachelor's 2,597, associate's 98, none 6,669.
- Feed with the example profile and a master's: 129 shown of 89,784; 5 hidden for degree.

## 2026-11-05: Slice 11c, filter chips on the page

- Built test first:
  - Settings gain `workplaces`, `jobTypes` and `minYearlyPay`, with the hide reasons `workplace`, `job-type` and `pay`. A job whose board gives no workplace or job type, or that has no pay or pay in another currency, is kept. Hourly pay counts 2,080 hours a year, and the most a job pays is compared.
  - `filtersFromQuery` puts the page's chips (`within`, `workplace`, `jobType`, `level`, `maxYears`, `minPay`, `degree`) over the saved filters for one request; "any" clears a list or the degree, and a value it cannot use is refused with a 400 that names what it takes. `GET /api/feed` sends back the filters it used.
  - The page draws the chips from those filters (`renderChips`), keeps only the chips the user changed in the browser, reloads the feed when a server filter changes, and drops saved chips the server refuses.
  - "New since last visit": `nextVisits` treats a reload within 30 minutes as the same visit; cards first seen after the previous visit get a "New" mark, and the chip keeps only them.
  - The level, workplace and job-type value lists moved to `feed/filterValues.ts`, since `settings.ts` reads files and cannot go into the page bundle.
- Found by trying the chips against the real feed: an empty level list hid every job with a level (117) while the other empty lists meant "any". Now an empty level list means any level, with a test.
- Real data, example profile, through the server: no chips 129 shown; remote 68 (92 hidden for workplace); $150k+ 97 (38 for pay); last 7 days 17; any level, up to 10 years, any degree 260. Shown plus hidden is 89,784 every time. `workplace=office` is refused with its message.
- In the browser: pressing "remote" and picking "$100k+" gave 61 shown, and only those two chips were saved. Greenhouse jobs stay under "remote" when their board does not say, as designed. "New since last visit" was only tested with unit tests, since it needs a second visit later.

## 2026-11-05: Slice 11d, STEM OPT badge

- Built test first:
  - `canUseStemOpt(workAuth)`: true on STEM OPT, or for an F-1 student with a STEM degree. The E-Verify effect now uses it, and `GET /api/feed` sends it as `stemOpt`.
  - For those users, a card with the `e-verify` tag whose effect is "a plus" says "E-Verify employer: STEM OPT can work here". A job that another tag makes likely blocked or blocked gets no badge, so the card never says both.
  - An "E-Verify only" chip, shown only to those users, keeps the cards with the `e-verify` tag, whatever their effect. It is a page-only chip like "new since last visit": it is not sent to the server and does not reload the feed.
- Real data, example profile (F-1 OPT, STEM degree): 5 of the 129 shown jobs have the tag, 4 get the badge (ID.me, Wilson Elser, Twilio, Superhuman); MegazoneCloud's co-op is likely blocked by another tag and gets none. In the browser the chip showed those 5 and was cleared afterwards.
- Not handled: 136 of the 3,116 US jobs with an E-Verify sentence say it applies only "in certain locations" or "where required" (Twilio and Analytic Partners, for example). They are still tagged `e-verify` and get the badge, which may overstate it. Counted with a one-off script over data/jobs.jsonl.

## 2026-11-05: Slice 11e, settings panel

- Built test first:
  - Matching is split: `readMatch` (skills, level, years, degree; the slow part, and it does not depend on settings) and `scoreReads` (adds the title match). `prepareJobs` does tags, reads, pay and H-1B history once; `rankJobs` scores and orders for given settings. `getJobs` is the two together, so `top` and `tags` are unchanged.
  - The server keeps the prepared jobs. `GET /api/settings` sends the settings in use (or null). `POST /api/settings` checks them with `parseSettings`, writes data/settings.json with the safe write (temporary file, then rename), and ranks again; a mistake answers 400 with every problem and changes nothing.
  - With no settings.json the feed starts anyway: `/api/feed` answers `needsSettings: true` with no jobs, and the page opens the panel.
  - The panel (`renderSettingsForm`) shows status, sponsorship later, STEM degree, clearance, roles (four groups of common roles plus free text), levels, places, remote only, posted within, years and degree. It sends the saved settings it does not show unchanged. The status and clearance lists moved to `feed/filterValues.ts` so the page bundle stays free of file code.
- Timings on the full list (89,784 jobs), one process, this laptop (8 GB RAM, other programs open):
  - Before: ranking at startup took 119 s (tags 40 s, matching 77 s, pay 1 s). Startup with the new build: 147 s to the first answer.
  - `prepareJobs`: 131 s, once. `rankJobs` after that: 2.2 s to 2.5 s in the runs that were not paging, but 11 s, 33 s and 40 s in runs where the machine was. Swap use was 13.5 GB of 14 GB during these runs, and the server process was almost fully swapped out.
  - Through the server: a save took 16 s to 37 s on curl, and 100 s for one, all while paging. From the page, a save took over a minute. So on this machine a save is minutes faster than a restart (about 2.5 minutes), but not quick. What it costs on a machine with free memory is unverified.
  - Building the role patterns once per re-rank instead of once per job made no difference I could measure.
- In the browser: the panel showed the saved settings; unticking every role and saving showed the roles message and left the file alone; ticking "analytics engineer" and choosing citizen gave 168 shown (129 before), the same as the one-process run. The original settings.json was put back afterwards and is byte for byte the same.
- Not tried by hand: the first-setup path with no settings.json (covered by a server test and a form test only).

## 2026-11-06: Slice 12a, smaller feed server

- Built test first:
  - `jobPreparer` prepares one job and drops its description; `prepareJobs` maps it over a list. Ranked and prepared jobs are now `JobSummary` (a job record without the description). Nothing after preparing read the description, so `top`, `tags`, the filters and the cards are unchanged, and the typecheck needed no other edit.
  - The tag sentences are cut out of the description, and V8 can keep a whole string alive through a slice of it, so they are copied (through JSON) before the description goes.
  - `prepareJobsFile` reads data/jobs.jsonl one line at a time and prepares each job as it goes, so the 562 MB file is never held whole. The feed command uses it.
- Measured with `/usr/bin/time -l` and `footprint` on the full list (89,784 jobs), same profile and settings, one run each:

| | Before | After |
|---|---|---|
| Peak memory footprint | 1,480 MB | 547 MB |
| Footprint while serving | 1,399 MB | 471 MB |
| Time to first answer | 221 s | 136 s |
| Settings save (3 tries) | 16 s to 100 s (slice 11e, while paging) | 0.8 s, 1.5 s, 2.4 s |
| Swap in use at start | 7.9 GB | 6.0 GB |

- Startup and save times depend on how much the machine is paging, and the swap use differed between runs, so treat them as rough. The memory numbers are the main result. The feed showed the same 129 of 89,784 jobs afterwards.
- Side effect of the save test: it re-sent the current settings, so data/settings.json was rewritten with every default written out. The values are the same as before.

## 2026-11-06: Slice 12b, E-Verify in some places

- Built test first: a new tag `e-verify-some-places` for E-Verify used only in "certain", "some" or "select" locations, states or jurisdictions. Its effect is "ok" for everyone, so it is not a plus and gets no STEM OPT badge; the card still shows it with its sentence. `e-verify` no longer matches those sentences. "E-Verify only" keeps both tags.
- Correction to slice 11d: the 136 jobs counted there also matched "as required by law", which on its own is a firm statement (Zone 5 Technologies: "As required by law, we will verify ... all new employees using the E-Verify system"). Reading the sentences by wording, only "in certain locations" is conditional; "where required" and "some states" appear in no US E-Verify sentence.
- Real data, `node dist/cli.js tags --status f1-stem-opt`, before and after: `e-verify` 3,153 then 3,085, `e-verify-some-places` 68; jobs that are a plus for STEM OPT 3,426 then 3,359. All 68 moved jobs carry one of two sentences: Twilio (55) and Analytic Partners (13), "participates in the E-Verify program in certain locations, as required by law". Blocked and likely-blocked counts did not change.
- The `tags` runs rewrote data/tag-check.json, the hand-check sample, which is generated and git-ignored.

## 2026-11-06: Slice 12c, review leftovers

- Built test first, one fix per finding from the review (all low):
  - F10: `boardKey` and `siteOf` (src/boardKey.ts) name a board as `lever-eu:<slug>` when it is a Lever EU board. The cache (folder `cache/lever-eu/`), the dead-board marks and the company list all use it, and `BoardResult` carries the region, so a US and an EU board with the same slug no longer share anything.
  - F11: a numeric entity past U+10FFFF, such as `&#99999999;`, is left as written instead of throwing and failing the whole board.
  - F13: Lever and Ashby slugs are decoded inside a try and trimmed, so `xpansiv%20` becomes `xpansiv` and a broken `%` no longer throws. `--board lever-eu:<slug>` reads an EU board.
- Real data: today's list has 4 Lever EU boards (cirrus, quantinuum, prima, coretechsecurity) and none shares a slug with a US board, so F10 changes no result now; their cache files move to `cache/lever-eu/`, so the next collect asks for those 4 again. One slug in data/companies.json, `xpansiv%20`, is decoded the next time the company list is built.
- Tried for real with `collect --board lever:xpansiv --board lever-eu:cirrus` (2 requests, written to data/jobs.boards.jsonl only): cirrus read 127 jobs through the EU address and was cached under `lever-eu/`; `xpansiv` still answers 404, so that board is closed, not just misnamed.
- Slice 12 is done. Still waiting for a decision: the lockfile entry, full text only for filtered jobs, Databricks and Coinbase, extra statuses, myworkdaysite.com links.

## 2026-11-07: Slice 13a, lock the local server

- From the November review: any website could change settings and statuses with a plain form post (the body was read as JSON whatever its type), the server answered any Host (so DNS rebinding could read the feed and history), a request for "//" stopped the server, a missing page file stopped it too, and a busy port hung the start.
- Built test first (8 new server tests, with a raw HTTP helper so a test can set Host and Origin):
  - Every request must name 127.0.0.1 or localhost on the feed's port as its Host, or it gets 403.
  - A POST must be application/json (415 otherwise), must not come from another site's Origin (403), and must carry the session token in X-Feed-Token (403). The server makes a random token at start and writes it only into the page it serves; the page sends it back on both POSTs.
  - The address is read inside the error handler (a broken one gets 400), the page file is read before answering (a missing page gets 500 and the server keeps running), a taken port gives "Port N is already in use.", and an error after the answer started closes that one connection.
  - Every answer carries Content-Security-Policy (default-src 'self', inline styles allowed for the page's style block, frame-ancestors 'none'), nosniff, no-referrer and no-store.
- Real feed, the review's own attacks again: text/plain POST 415 (was 200 and saved), foreign Host 403 (was 200), another site's Origin 403, JSON without the token 403, GET // 400 (was a crash) and the server kept answering. In the browser the page loaded under the new headers with all 129 cards and no new console errors, and a save from the settings panel went through.
- Found while checking: the settings panel sends the roles in its own group order, so a save with nothing changed still rewrites settings.json with the roles reordered (same roles). data/settings.json was put back byte for byte afterwards.
- 694 tests pass, the typecheck is clean.

## 2026-11-07: Slice 13b, never lose a write

- From the November review: 10 status changes sent at once saved 2 (7 answered 500), because each save read applied.json, changed it and wrote it back with no lock, and every write used the same applied.json.tmp. Settings saves shared settings.json.tmp the same way, and a save wrote the file before ranking.
- Built test first:
  - `writeJsonFile` writes through its own temporary file each time (a random name) and removes it if the write fails, so two writes at once both finish and leave no stray file.
  - `createWriteQueue` (storage/writeQueue.ts) runs tasks one at a time in the order given; a failed task's error goes to its caller and the next task still runs.
  - The feed server puts each status save (read, change, write) and each settings save in one queue. A settings save ranks first, then writes the file, then puts both in use, so the file and the feed never disagree. Checking the request still happens before the queue, so a bad request does not wait.
- Measured with a throwaway server (temporary folders, 100 jobs), 3 runs: 100 status changes sent at once were all answered 200 and all 100 were saved, in 87 to 89 ms; 10 settings saves sent at once were all answered 200 and the file held the last one; no temporary files were left. Before: 2 of 10.
- In the review's test the settings case also showed something worse than lost saves: two saves writing into one temporary file left settings.json as broken JSON. That can no longer happen.
- 699 tests pass, the typecheck is clean.

## 2026-11-09: Slice 13c, "Remote only" trusts the board

- From the November review: "Remote only" looked for the word remote in a job's places and ignored the board's own workplace field, so 4,347 of the 7,612 jobs that Ashby and Lever mark remote would have been hidden.
- Built test first: with remoteOnly, a job is kept when its workplace is remote or a place says remote; a job marked onsite, or one whose board says nothing and whose places name only a city, is still hidden for "remote". Before this, no test set remoteOnly to true.
- Real data, one run over all 89,784 jobs with the example settings plus remoteOnly (scratch script, nothing saved): board-remote jobs hidden for "remote" went from 4,347 to 0. With these settings the feed shows 21 jobs instead of 15, and 174 are still hidden for "remote". Shown plus hidden is still 89,784.
- The 6 jobs gained include Jerry's two data scientist roles, Eastern Research Group's entry-level data analyst, Solace Health's data scientist and a Stand Together policy intern. Read 4 postings: Jerry ("We support remote work for most roles") and Eastern Research Group ("work independently in a remote environment") say so in the text; Solace Health and Stand Together say nothing in the text, so for those the board's field is the only evidence (unverified).
- 700 tests pass, the typecheck is clean.

## 2026-11-09: Slice 13d, the labelled set

- 200 real postings in `test/fixtures/labelled-jobs.json` (1.3 MB; the only email addresses are company ones), picked with fixed seeds: 100 of the 129 shown for the example profile, and 100 hidden across reasons (blocked 30, experience 20, role 15, abroad 10, title word 10, level 7, old 5, degree 3).
- Each job was read and marked one at a time from its title, places and the sentences about work authorization, years, degree and pay, without looking at what the readers found. Marked: the restrictions stated, years for someone with a master's, lowest degree required, pay, and whether the job is abroad. A fact the text could not settle is "?" and is not scored (2 restrictions, 9 degrees, 5 pay).
- After the first score the disagreements were read in full, and 20 labels were corrected: 15 degrees, 1 pay and 1 tag that were my errors (the snippets had left the sentence out), and 3 pay ranges that vary by location, now "?". Labels that disagree because the reader is wrong were left alone. So the labels are blind except where they were checked against the full text.
- `scoreLabels` (feed/scoreLabels.ts) compares the readers with the labels field by field and counts jobs wrongly hidden or wrongly shown for an F-1 OPT student with a STEM degree and a master's. `no-sponsorship` counts as covered by `no-future-sponsorship`, and `us-person` by `citizen-only`. `node dist/cli.js labelled --misses` lists every miss, and a test holds the scores at today's numbers or better.
- Today's score, before any rule change:

| Field | Right |
|---|---|
| Work-authorization tags | 183 of 198 (92%) |
| Years | 189 of 200 (95%) |
| Degree | 169 of 191 (88%) |
| Pay | 182 of 195 (93%) |
| Abroad | 196 of 200 (98%) |
| Hide or show | 177 of 189 (94%): 1 wrongly hidden, 11 wrongly shown |

- Misses seen, for 13e: bare clearance lines ("Active TS SCI Clearance", "Required Clearance: Secret"), "United States Citizenship is a strict minimum requirement", "No immigration sponsorship or transfer available", "Be either a US citizen or Permanent Resident", "Required Experience: 8 years", degree requirements read from company blurbs ("70% of our team holding advanced degrees at the Master's or PhD level"), single hourly rates and hourly ranges with no unit, a pay range mixing USD and CAD (Quora), and places abroad read as US (Darmstadt, DE; Victoria, British Columbia; London; King Abdullah Economic City).
- 200 jobs is still a small set: 92% on 198 tags has an error range of about 4 points either way.

## 2026-11-09: Slice 13e, close the rule gaps

- Built test first, 35 new tests from the real sentences the labelled set caught:
  - **Tags:** "Be either a US citizen or Permanent Resident", "United States Citizenship is a strict minimum requirement", "for which U.S. citizenship is needed", "sponsorship ... is not available", "No immigration sponsorship or transfer available", bare clearance lines ("Active TS SCI Clearance", "Required Clearance: Secret"), "based on OPT or CPT", and two wordings of an offer. "Ideally ..." and "(preferred but not required)" no longer count as a clearance rule, and "citizenship is not required" is no longer a citizens-only rule.
  - **Wish words:** one list in matching/wishWords.ts, used by years, degree and clearance. For years a wish now counts only in the clause of the years, or as a heading over a list.
  - **Years for a master's:** `yearsWithMaster` reads what someone with a master's needs: the years stated for a master's when a posting lists them by degree, none when a degree stands in for the years. The filter uses it when myDegree is master or PhD.
  - **Degree:** postgraduate degree counts as a master's; "prefer" is a wish; a company blurb about staff degrees is not a requirement.
  - **Pay:** small ranges with no unit are hourly when they end in USD or follow a pay word, and "/h" counts.
  - **London alone** is abroad. A job's country is stored when it is collected, so this reaches the feed after the next collect.
- Score on the labelled set, before and after (a test now holds the after numbers):

| Field | Before | After |
|---|---|---|
| Work-authorization tags | 183 of 198 | 197 of 198 |
| Years | 189 of 200 | 199 of 200 |
| Degree | 169 of 191 | 172 of 191 |
| Pay | 182 of 195 | 190 of 195 |
| Abroad | 196 of 200 | 198 of 200 |
| Hide or show | 177 of 189 (1 wrongly hidden, 11 wrongly shown) | 187 of 189 (0 wrongly hidden, 2 wrongly shown) |

- These after numbers flatter the rules: they were written from this same set's misses. Read them as "the known misses are fixed", not as accuracy on new jobs. A fresh sample is needed for that.
- Full list, old readers against new on all 89,784 jobs, changes read by kind: 365 more citizen-only (nearly all STR's "for which U.S. citizenship is needed"), 109 more no-sponsorship, 46 more clearance, 19 more sponsors, 6 no-visa-holders, 6 us-person, 3 fewer clearance (all "preferred but not required"), 135 fewer unclear, 2,839 jobs gained hourly pay (technicians and machinists at SpaceX and others), 111 jobs lost a years number, 102 gained one, and 1,026 jobs ask a master's holder for different years.
- Reading those changes caught regressions before they shipped, all fixed with tests: "preferably" after the years ("2+ years ... (preferably with Ruby)") dropped real years, "/hourly" stopped being read, "with degree or 15 without" and any "high school" dropped years for a master's holder, "Master Data Management" read as a master's degree, and "including visa sponsorship" as a job duty read as an offer.
- The feed with the example profile: 129 shown became 125; 6 left and 2 joined. Shown plus hidden is still 89,784.
- Left for later: pay stated as one number, a range mixing USD and CAD (Quora), degree misses where "or equivalent" means a field and not experience (19 degree misses remain), and years written "1-year".

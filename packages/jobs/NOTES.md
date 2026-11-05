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

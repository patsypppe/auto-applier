# Job feed technical plan

Status: draft for review, 2026-11-04. Implements `SPEC.md`. Where this plan changes the spec, it says so under "Changes to the spec".

## Ground rules

- New workspace package `@auto-applier/jobs` in `packages/jobs`. Nothing outside it changes.
- No new dependencies. Checked: with a `packages/jobs/package.json` and no `npm install`, `npm run <script> -w @auto-applier/jobs` runs, `vitest` and `esbuild` resolve from the root `node_modules`, `@auto-applier/core` resolves through its existing symlink, `package-lock.json` stays unchanged, and the root `npm test` still passes (691 + 228).
- Same tools and style as the rest of the repo: TypeScript strict, `zod/mini` only at the edges, Vitest, esbuild, plain functions, string-literal unions, no mutation, options objects for `fetchFn` and `sleep`.
- Node 26 cannot run the repo's extensionless TypeScript imports directly, so the command line and the page script are bundled with esbuild into `packages/jobs/dist`, the same way the extension is built.
- Everything personal or collected lives in `packages/jobs/data/`, ignored by `packages/jobs/.gitignore`. Example files sit next to it as `*.example.json`.

## File layout

```
packages/jobs/
  package.json            scripts: test, typecheck, build, companies, collect, feed, h1b, export-applied
  tsconfig.json           extends ../../tsconfig.base.json, types ["node"]
  build.mjs               esbuild: src/cli.ts -> dist/cli.js (node), src/page/page.ts -> dist/page.js (browser)
  .gitignore              data/, dist/
  README.md               what it does, how to run it, known limits, O*NET credit
  NOTES.md
  docs/                   RESEARCH, SPEC, PLAN, INTEGRATION, REPO_SUMMARY
  data.example/           profile.example.json, settings.example.json, companies.extra.example.json
  skills/onet-skills.json trimmed O*NET Technology Skills list (CC BY 4.0, credited)
  test/fixtures/          saved responses per ATS, the 60 tagged postings, list samples
  src/
    index.ts              exports getJobs, applyFilters and the public types
    types.ts              JobRecord, AuthTag, Effect, RankedJob, AppliedEntry, Company
    settings.ts           FeedSettings type, zod/mini schema, defaults, loadSettings
    fetching/
      fetchJson.ts        one GET or POST with timeout and retries on 429 and 5xx
      collectBoards.ts    walks one ATS's boards in order with a pause between requests
    sources/
      greenhouse.ts       fetchGreenhouseBoard, toJobRecord
      lever.ts            fetchLeverBoard
      ashby.ts            fetchAshbyBoard
      workday.ts          fetchWorkdayBoard (later slice)
      plainText.ts        HTML to text, entities decoded
      country.ts          reads a job's country from its location fields
    companies/
      readListings.ts     pulls (ats, slug) out of Simplify listing URLs
      readAggregator.ts   reads the MIT aggregator slug lists
      buildCompanyList.ts merges, dedupes, applies companies.extra.json
    dedupe/
      textHash.ts         fingerprint of board, title and text without the job's own places and dates
      mergeCopies.ts      one job per opening, copies at different places joined, every copy's link kept
      linkReposts.ts      first-seen dates across runs, links to an earlier copy that is gone
    tags/
      sentences.ts        sentence splitter that knows "U.S.", "Inc.", "e.g."
      rules.ts            the phrase rules as data
      tagJob.ts           tagJob(job) -> Tag[]
      effects.ts          EFFECTS table: status x tag -> effect
    matching/
      skills.ts           findSkills(text, dictionary)
      level.ts            levelFromTitle
      scoreMatch.ts       score and reasons
    history/
      normalizeName.ts    company name normalising
      readH1bData.ts      reads the history file (see changes to the spec)
      matchEmployer.ts    board company -> employer history, with aliases
    feed/
      getJobs.ts          the public interface
      applyFilters.ts     splits ranked jobs into shown and hidden-with-reason
      applied.ts          status changes on the applied history
    storage/
      files.ts            read and write the JSON files in data/
    server/
      serveFeed.ts        node:http on 127.0.0.1: the page, GET /api/feed, POST /api/applied
    page/
      index.html, page.ts, renderJob.ts, filtersPanel.ts
    cli.ts                parses the command and calls the steps above
```

Files stay small with one job each, like the core package.

## Data shapes

```ts
export type Ats = "greenhouse" | "lever" | "ashby" | "workday"

export type Company = {
  name: string
  ats: Ats
  slug: string            // Workday: "tenant|wd5|site"
  sources: string[]       // "simplify-new-grad", "aggregator", "extra"
}

export type JobRecord = {
  key: string             // "greenhouse:stripe:7319791002"
  ats: Ats
  slug: string
  company: string
  id: string
  title: string
  url: string
  locations: string[]
  country?: "US" | "other"   // undefined when the location does not say
  postedAt?: string
  updatedAt?: string
  firstSeenAt: string
  lastSeenAt: string
  description: string     // plain text
  textHash?: string       // set when copies are joined, used to find reposts
  repostOf?: string
  copies?: { id: string; url: string; locations: string[] }[]   // only on a joined job
  repostOf?: string       // key of the earlier copy
}

export type AuthTag =
  | "citizen-only" | "us-person" | "clearance" | "no-sponsorship" | "no-future-sponsorship"
  | "sponsors" | "opt-cpt-welcome" | "e-verify" | "unclear" | "not-stated"

export type Tag = { tag: AuthTag; evidence: string; context: string }

export type WorkAuthStatus =
  | "citizen" | "permanent-resident" | "f1-cpt" | "f1-opt" | "f1-stem-opt" | "h1b" | "other-needs-sponsorship"

export type Effect = "blocked" | "likely-blocked" | "ok" | "positive"

export type MatchReasons = {
  matchedSkills: string[]
  missingSkills: string[]
  titleMatches: boolean
  level?: "intern" | "new-grad" | "entry" | "mid" | "senior" | "staff"
}

export type EmployerHistory =
  | { status: "matched"; employer: string; approvals: number; fiscalYear: number }
  | { status: "none" }
  | { status: "ambiguous"; candidates: string[] }

export type ApplicationStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected"

export type AppliedEntry = {
  key: string
  company: string
  title: string
  url: string
  status: ApplicationStatus
  changes: { status: ApplicationStatus; date: string }[]
  note?: string
}

export type RankedJob = {
  job: JobRecord
  tags: Tag[]
  effect: Effect          // the worst effect of its tags for this user
  score: number           // 0 to 100
  reasons: MatchReasons
  history: EmployerHistory
  applied?: AppliedEntry
}
```

`FeedSettings` follows the settings table in `SPEC.md`, checked with a `zod/mini` schema. A bad file throws one error with each problem as `"filters.levels: expected one of intern, new-grad, ..."`, the same format as `validateProfile`.

The resume profile is the core's `Profile`, loaded from `data/profile.json` and checked with `validateProfile`. Nothing is added to it. Skills found in an optional resume text are kept beside it for matching and never saved into it.

## Collecting

- `fetchJson(url, options)` makes one request with a 30 s timeout. On 429, 500, 502, 503 or 504 (`isRetryableStatus` from core) or a dropped connection, it waits 1 s, 3 s, then 9 s and tries again. Other statuses throw an error saying which board and what status, such as `"Greenhouse board 'acme' returned 404. It may have moved to another job site."`. It takes `fetchFn` and `sleep`, like `GeminiLLMClient` and `RetryingLLMClient`.
- One user agent string for every request, generic and fixed (`Mozilla/5.0 (compatible; job-feed/0.1)`), never rotated.
- `collectBoards(companies, fetchBoard, options)` goes through one ATS's boards one at a time, with `delayMs` (default 1000) between requests. Greenhouse, Lever and Ashby run at the same time because they are different hosts. That gives "one request at a time per host" without a queue class.
- Each board's raw response is cached in `data/cache/<ats>/<slug>.json` with its fetch time. A cache younger than `cacheHours` is reused unless `--fresh`.
- Greenhouse is fetched with `content=true` in the first version, because one call is simpler than two. Stage 1 measured about 0.6 MB per board. If the full run is too slow or too big, the next step is lists without content plus `GET /v1/boards/{slug}/jobs/{id}` only for jobs that pass the title and location filters.
- Workday (later slice): 20 per page, stop at `total` or at an empty page, then one detail call per job that passes the filters, at the same pause.
- A board that returns 404 on two different days is recorded in `data/dead-boards.json` and skipped afterwards.
- The run log (`data/requests.log`) records each request's time and host, so politeness can be checked in Stage 5. Retries are not logged.

## Reposts and duplicates

- Inside one run: jobs on the same board with the same title and the same `textHash` become one record, but only when they are listed at different places; two copies at one place are separate openings. The joined record has the locations combined, the lowest id as its key, and a `copies` list with each copy's own link. This covers the multi-location copies seen at SpaceX and Databricks.
- Across runs: a job with a key seen before keeps `firstSeenAt`. A new key whose `textHash` matches a job seen in the last 60 days, and no longer listed, gets `repostOf`, and its applied entry is found through that link.
- The description is normalised before hashing (lowercase, whitespace squashed, the job's own place names and dates removed). Other numbers stay, so openings with different pay or experience stay apart. Tests use saved real pairs.

## Resume

- No key needed: `findSkills(resumeText, dictionary)` scans `data/resume.txt` and adds what it finds to the profile's skills for matching.
- PDF resumes need `pdfjs-dist`. It is installed at the root for the extension, but declaring it here changes the lockfile. That waits for your answer (open question 3). Until then, PDF users save their resume as text.
- Optional `--llm`: builds a `GeminiLLMClient` or `GroqLLMClient` from `data/llm-settings.json` (the same `ProviderSettings` shape the extension stores) through the core's `createFallbackClient`, runs `parseResume`, and writes `data/profile.draft.json` for the user to check. It never overwrites `profile.json`.

## Matching

- The skill dictionary is O*NET Technology Skills "Example" names, trimmed to the ones flagged Hot Technology plus common data and software terms, together with `data/skills.extra.json` and the profile's own skills. It is matched case-insensitively on word boundaries.
- Short or ambiguous names (R, Go, C, Rust, Spark, Swift, Excel) only count with case and context rules, for example "R" only next to words like "Python", "SQL", "statistics", or written as "R," or "(R)". Each rule has a test with a real false-positive sentence.
- `score = round(70 * matched / max(1, matched + missing) + 30 * (titleMatches ? 1 : 0))`. A job naming no known skills gets the title part only, and the card says "No skills listed".
- Level and location are filters, not part of the score.
- Ties are broken by newest posting date.

## Work-authorization tags

- `sentences.ts` splits text on sentence ends but not after "U.S.", "U.S.A.", "Inc.", "e.g.", "i.e." or single capital letters. Bullet lists without periods are split on line breaks kept from the HTML.
- `rules.ts` is a list of `{ tag, pattern, unless? }`, checked in order:
  1. Restrictions first: citizen-only, us-person, clearance, no-future-sponsorship ("now or in the future"), no-sponsorship.
  2. Positives, each with an `unless` for negation within the four words before ("unable to", "not able to", "cannot", "do not") and for non-visa senses ("technical sponsor", "sponsor the clearance").
  3. Acronyms (OPT, CPT, EAR, ITAR, EAD) are case-sensitive and need a nearby work word ("student", "F-1", "visa", "work authorization", "export").
- A sentence naming another country's work rules ("authorized to work in Canada") is skipped. A job whose `country` is `other` gets no restriction tags, so the boilerplate on Berlin and Sydney jobs cannot hide anything.
- `unclear`: the sentence has a work-authorization word (sponsor, visa, H-1B, work authorization, citizenship, OPT) and no rule matched.
- `not-stated`: no tag at all.
- `effects.ts`: one `Record<WorkAuthStatus, Record<AuthTag, Effect>>` built from the table in `RESEARCH.md` section 5. `needsSponsorshipLater: false` turns `no-sponsorship` from likely-blocked to ok for F-1 statuses. `clearance: "active"` or `"can-obtain"` makes `clearance` ok for citizens.
- The fixture is the 60 appendix postings, with their text cut to the paragraph around the phrase plus the job's location. There is one test per hand-check row.

## Sponsorship history

See "Changes to the spec": the first version reads the USCIS H-1B Employer Data Hub CSV, and the DOL LCA file comes later.

- `normalizeName`: lowercase, `&` to `and`, punctuation dropped, endings removed (inc, llc, l.l.c., corp, corporation, co, company, ltd, limited, plc, lp, llp, pbc, holdings), spaces squashed.
- `matchEmployer(company, history, aliases)`: alias first, then an exact normalised match, then a match on the first two words only when exactly one employer has them. Anything else is `ambiguous` or `none`. No fuzzy scores, so a match is either exact or explained.
- The CLI prints the match rate and writes the unmatched names to `data/h1b-unmatched.txt` so aliases are easy to add.

## Feed page

- `npm run feed` builds, starts `serveFeed` on `127.0.0.1:4317` (port in settings), and prints the address.
- `GET /api/feed` returns `getJobs` output plus the hidden counts per reason. `POST /api/applied` takes `{ key, status, note? }` and writes `data/applied.json`. Nothing else is served. Request bodies are checked with `zod/mini`.
- The page is one HTML file and one bundled script. Job text is set with `textContent` only. Filters run in the page over the loaded data. The page keeps the filter state in `localStorage`.
- Each card: title (link), company, locations, posted date, score, matched and missing skills, tags as chips (the click shows the evidence and context), the history line, and the status menu with the date of the last change.
- The header: counts shown and hidden, each hidden reason clickable to show those jobs greyed.

## The interface

Changed from the spec: plain data in, plain data out, so neither side needs a storage interface.

```ts
export type FeedData = {
  jobs: JobRecord[]
  applied: AppliedEntry[]
  history: EmployerHistoryFile
  extraSkills: string[]
}

export function getJobs(settings: FeedSettings, profile: Profile, data: FeedData): RankedJob[]
export function applyFilters(jobs: RankedJob[], settings: FeedSettings): { shown: RankedJob[]; hidden: { job: RankedJob; reason: string }[] }
```

The Node command reads `FeedData` from files. An extension page would read it from `chrome.storage.local` or IndexedDB and call the same two functions.

## Test plan

- Vitest in `packages/jobs`, colocated `*.test.ts`, the same style as core: `describe("tagJob: negation")`, plain sentence names, arrange / act / assert, small commented helpers.
- No network. Every source test uses a saved response in `test/fixtures` (a few jobs per ATS, trimmed, recruiter names removed) and a fake `fetchFn`. Retry and pause tests use a fake `sleep` and assert the waits.
- Tags: the 60 appendix postings, plus one test for each false positive found in research (system optimization, Cyber Penetration Teams, a strong ear, technical sponsor, sponsor the clearance process, Singapore, Berlin boilerplate, E-Verify as an HR skill).
- Matching: the short-skill rules, ties, and "no skills listed".
- Dedupe: saved multi-location copies and a repost pair.
- History: a small made-up CSV in the real column layout, plus the normaliser cases.
- Filters: hidden + shown always equals the total, checked as a property over the fixtures.
- Server: start on port 0, call both routes with `fetch`, check `applied.json` in a temp folder.
- Page: jsdom tests for `renderJob` (no `innerHTML`, evidence shown, applied date shown).
- `npm run typecheck -w @auto-applier/jobs` (tsc on `packages/jobs`) and `npm test -w @auto-applier/jobs` pass on every slice. The root `npm test` is run too, to be sure nothing else changed.

## Merge plan

Written into `docs/INTEGRATION.md`, kept current as slices land.

- **What the extension would call:** `getJobs` and `applyFilters` from `@auto-applier/jobs`, plus the collectors with `fetchFn` set to the extension's `fetch`. They need host permissions for `boards-api.greenhouse.io`, `api.lever.co`, `api.ashbyhq.com` and later `*.myworkdayjobs.com`. The profile comes from the existing `ChromeStorageProfileStore`.
- **Files the final merge touches outside `packages/jobs`:**
  - Root `package.json`: add the jobs package to `test` and `typecheck`.
  - `package-lock.json`: the workspace entry appears on the next `npm install`.
  - `packages/extension/public/manifest.json`: host permissions, plus a jobs page if one is wanted.
  - `packages/extension/build.mjs`: a jobs page entry.
  - New extension files for the page and its storage.
  - `README.md` and the root design notes: one section each.
- **Possible conflicts with the autofill branch:**
  - If `Profile` or `validateProfile` change shape, the jobs package only reads skills, experience and education, so the risk is small. Its tests use a profile built from the core types and would catch it.
  - If the autofill branch adds a detailed work-authorization field to `Profile.answers`, `settings.workAuth` should move there at the merge.
  - If he changes `isRetryableStatus` or removes it from core's exports, `fetchJson` breaks at compile time.
  - Both branches editing `manifest.json` and `build.mjs` at the merge is the most likely text conflict.

## Build slices

Each slice: tests first, then code, then the package tests, the typecheck and the root tests, then one or more small commits. Stop after each.

1. **Package and Greenhouse.** `package.json`, `tsconfig.json`, `build.mjs`, `.gitignore`, `fetchJson`, `plainText`, `country`, `fetchGreenhouseBoard`, and `collect --board greenhouse:<slug>` writing `data/jobs.jsonl`. Usable: collect one Greenhouse board.
2. **Lever and Ashby.** Their collectors, the three ATSs at once with the pause and the cache, and the run summary.
3. **Company list.** `npm run companies` from the Simplify files (aggregator lists opt-in), `companies.extra.json`, dead-board marking, and a full `collect`.
4. **Dedupe and reposts.**
5. **Work-authorization tags and effects**, with the appendix fixture.
6. **Settings, profile, matching, `getJobs`, `applyFilters`**, with a small `npm run feed -- --text` that prints the top jobs in the terminal.
7. **Feed page and applied history**, including `export-applied`.
8. **Sponsorship history** from the USCIS CSV (after the download is approved).
9. **Workday collector.**
10. **Resume:** text skill scan, `--llm` draft, PDF if the dependency is approved.

Stage 5 (real data check) follows slice 8 at the latest, so the targets in `SPEC.md` can be measured with history included.

## Slice 11: setup screen, filters on the page, pay, degree, STEM OPT

Status: draft for review, 2026-11-05. Comes from the comparison with Jobright and Tsenta. Slice 10 (resume) is still not
built and is not part of this.

What was checked before writing this:

- Ashby's board response already has a `compensation` field per job, with `compensationTiers[].components[]`
  holding `compensationType` ("Salary"), `interval` ("1 YEAR"), `currencyCode`, `minValue` and `maxValue` (seen in
  `test/fixtures/ashby-ramp.json`, all 3 jobs). It also has `employmentType` ("FullTime") and `workplaceType`
  ("OnSite", "Hybrid"). We drop all of these today.
- Lever's response has `workplaceType` ("hybrid") and `categories.commitment` ("Permanent"). The Spotify fixture has
  no pay field, so Lever pay comes from the text only.
- Greenhouse has no pay or job-type field (`test/fixtures/greenhouse-databricks.json` keys); its pay is in the
  posting HTML.
- Over the 59,910 jobs with country US in data/jobs.jsonl, 12,752 (21%) have a "$X to $Y" range in the text, by a
  rough pattern that misses hourly ranges. A rough count, not the reader's real accuracy.
- The server already applies the filters on every `GET /api/feed`, so changing a filter needs no new ranking.
  Changing the work-authorization status does, since effects depend on it.

Each part is tests first, then code, then the tests, the typecheck and a check on the real data, then a stop.

**11a. Keep pay, job type and workplace when collecting.**
- `JobRecord` gains optional `pay` (`{ min, max, currency, per: "year" | "hour", from: "board" | "text" }`),
  `jobType` (`full-time`, `part-time`, `contract`, `intern`, `temporary`) and `workplace` (`remote`, `hybrid`,
  `onsite`). Only set when the board or the text says so.
- Ashby: pay from the Salary component, job type from `employmentType`, workplace from `workplaceType`.
- Lever: workplace from `workplaceType`, job type from `categories.commitment` only for values it clearly names.
- `readPay(text)` for every source without board pay: "$120,000 - $150,000", "$120K to $150K", "$45 - $55 per
  hour". Ranges only; a single number such as "$5,000 sign-on bonus" is not pay.
- Check: 40 jobs by hand, pay read against the text. Needs one collect from the cache (no requests if run within
  12 hours of a collect, otherwise a normal polite run).

**11b. Degree.**
- `degreeRequired(text, title)` returns the lowest degree the posting requires: `bachelor`, `master` or `phd`. "PhD"
  in the title counts; "Master's preferred" does not, the same rule as the years reader. "Bachelor's or Master's"
  is bachelor.
- Settings gain `filters.myDegree` (default none set, so nothing is hidden). A job that requires more is hidden with
  the reason `degree`.
- Check: 40 jobs by hand.

**11c. Filters on the page.**
- A row of chips over the cards, like the two sites: posted within (7, 30, 90 days), workplace (remote, hybrid,
  onsite), job type, level, max years, min pay, degree, and "new since my last visit".
- The page sends them as query parameters; the server applies them on top of settings.json for that request only.
  Hidden counts still add up to the total. The page remembers the chips in `localStorage`.
- Min pay: a job with no pay stays shown (most have none), the same choice as for years.
- "New since my last visit": the page saves the time of each visit in `localStorage` and marks cards first seen
  after it.

**11d. STEM OPT badge.**
- When the status is `f1-stem-opt`, or F-1 with `stemDegree: true`, a job with the `e-verify` tag shows "E-Verify
  employer: STEM OPT can work here". A chip "E-Verify only" hides the rest.
- The effect already treats E-Verify as a plus for these users, so only the page changes.

**11e. Setup screen.**
- A "Settings" panel on the page with the fields from settings.json: status, sponsorship later, STEM degree,
  clearance, roles (a fixed list of common roles grouped as on Jobright, plus free text), levels, locations, remote
  only, posted within, max years, degree. Opens by itself when settings.json does not exist yet.
- Saved through a new `POST /api/settings`: checked with `parseSettings`, written to settings.json with the safe
  write, then the server re-ranks.
- Re-ranking today re-tags every job (about 90,000; the feed takes about a minute to start). `getJobs` is split so
  the tags, which do not depend on settings, are kept and only the effects and scores are worked out again. The
  time is measured before and after.

Not in this slice: resume upload (the core's parser needs an AI key; slice 10), Labor Department wage data (its
file is a 252 MB Excel file, see "Changes to the spec"), applicant counts, alumni, funding (no free source),
"apply to all" (autofill is the friend's part).

Questions:
1. Should the setup screen also edit the skills list, which lives in profile.json in the core's `Profile` shape?
   Default: no, settings only; skills stay in profile.json.
2. Min-pay chip: keep jobs that state no pay (default), or hide them?

## Slice 12: memory, E-Verify wording, review leftovers

Status: draft for review, 2026-11-06. Slice 11 is done (6ba5232). Main has the branch up to slice 8 (3a9f395, merged
on 2026-11-04); slices 9 to 11 are on job-feed only.

What was checked before writing this:

- The feed server keeps every job's full description after `prepareJobs`, but nothing reads it again: `applyFilters`,
  `toCard` and the server routes never use `description` (checked with grep). The jobs file is 562 MB.
- On this laptop (8 GB RAM, about 13.5 GB swap in use) the server was almost fully swapped out, and a settings save
  took 16 s to 100 s against 2.2 s to 2.5 s for `rankJobs` in a run that was not paging (NOTES.md, slice 11e).
- 136 of the 3,116 US jobs with an E-Verify sentence say it applies only in certain locations or where required
  (NOTES.md, slice 11d). They get the STEM OPT badge today.

Each part is tests first, then code, then the tests, the typecheck and a check on the real data, then a stop.

**12a. Smaller feed server.**
- `prepareJobs` keeps what the server needs and drops the description, so the prepared job holds no long text. The
  tag evidence and context sentences stay, since the cards show them.
- The feed command reads the jobs file one job at a time (`eachJob`) and prepares each as it goes, so the whole file is
  never in memory at once.
- Measured before and after: peak memory (`/usr/bin/time -l`), memory once serving, startup time, and save time, each
  noted with the swap in use, since this machine's numbers swing.

**12b. E-Verify only in some places.**
- New tag `e-verify-some-places` for "in certain locations", "where required by law" and similar, instead of
  `e-verify`. Its effect is "ok" for everyone, so it is not a plus and gets no badge.
- The card shows it as a tag with its sentence, so the user can see it. "E-Verify only" keeps both tags.
- Checked by reading the sentences that move from one tag to the other.

**12c. Review leftovers (all low).**
- F10: Lever EU boards get their own cache file, list entry and dead mark (`-eu` in the key).
- F11: an invalid numeric entity such as `&#99999999;` is left as it is instead of failing the whole board.
- F13: Lever slugs are URL-decoded, a bad `%` in an Ashby slug no longer throws, and `--board lever-eu:slug` works.

Not in this slice: the lockfile entry, full text only for filtered jobs, Databricks and Coinbase, extra statuses
(asylee, refugee, H-4 EAD, TN), myworkdaysite.com links. These still wait for a decision.

Questions:
1. 12b: should "E-Verify in some places" still count as a plus for a STEM student? Default: no, it is "ok", because
   the posting does not say the job's own place is covered.
2. 12a: is it fine that a job's description is no longer in memory? Only the server is affected; `top`, `tags` and
   `collect` keep reading the file as now. Default: yes.

## Changes to the spec

- **H-1B history from USCIS first, DOL later.** The USCIS Data Hub gives actual petition decisions per employer as CSV. The DOL file is a 252 MB Excel file, and reading it without a new dependency means writing a zip and XML reader. The DOL data adds wage levels and job titles, which are useful but not needed for the first version. F6 changes accordingly: the card says "USCIS approved N H-1B petitions for this employer in FY2026".
- **`getJobs` takes plain data** instead of a store, as shown above.
- **PDF resumes wait** for the dependency decision. Text resumes work from slice 10.

## Open questions

1. Comment style: decided, follow the friend's rule (one line at the top of each file and above each function).
2. May I download the USCIS H-1B Employer Data Hub CSV for slice 8? (The DOL file is no longer needed for the first version.)
3. May `packages/jobs` declare `pdfjs-dist` (changes the lockfile), or should PDF stay out of this branch?

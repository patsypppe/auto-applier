# Job feed spec

Status: draft for review, 2026-11-04. Based on `RESEARCH.md`. Runs as a Node command plus a local page (option A, approved).

## Problem

A student applying to a few hundred companies has to open each career site, guess which roles fit, and read every posting to find out whether it would even consider them. For an international student the second part is the slow one: the answer is usually buried in one sentence, often missing, and the company's real sponsorship record is somewhere else (DOL filings). Existing tools give a single match percentage and a sponsorship label without showing where it came from, and charge for the useful filters.

The job feed collects postings from the companies' own public job boards, ranks them against the user's own profile, tags each one with what it says about work authorization (with the sentence as evidence), shows the employer's H-1B filing history next to it, and keeps track of what the user applied to. Everything runs on the user's own machine.

## Two example users

Both are made up.

**Sam, U.S. citizen, BS in Computer Science, looking for new-grad software and data roles in California or remote.**
1. Copies `profile.example.json` to `data/profile.json` and fills in skills, education and jobs (or pastes a profile saved from the extension, same shape).
2. Copies `settings.example.json` to `data/settings.json`. Sets status `citizen`, locations `["CA", "Remote US"]`, roles `["software engineer", "data engineer"]`, levels `["new-grad", "entry"]`.
3. Runs `npm run companies -w @auto-applier/jobs` once to build the company list.
4. Runs `npm run collect -w @auto-applier/jobs`. The terminal shows progress per ATS and ends with a summary: boards read, boards failed (with reasons), jobs kept, time taken.
5. Runs `npm run feed -w @auto-applier/jobs` and opens the printed `http://localhost:` address.
6. Sees jobs ranked by fit. Each card shows matched and missing skills. Jobs needing a clearance show a "Clearance" tag with the sentence. Sam leaves them visible (Sam can get one).
7. Applies on the company site, comes back, ticks "Applied". The date is saved. Next week the job shows as applied, even after a new collection.

**Priya, F-1 student, MS in Statistics (on the DHS STEM list), graduating May 2027, will use OPT then STEM OPT, needs H-1B later.**
1. Same setup. Sets status `f1_opt`, `stemDegree: true`, `needsSponsorshipLater: true`.
2. After collecting, the feed hides jobs tagged "U.S. citizenship required", "U.S. person (ITAR)", "Security clearance" and "No sponsorship". The header says "Hidden by work authorization: 212 (show)". Clicking shows them greyed, with the reason.
3. Jobs whose posting says nothing are shown with "Not stated" and, next to it, "USCIS approved 340 H-1B petitions for this employer in FY2026". Jobs at employers with none say "No H-1B approvals found for this employer".
4. A posting that says "We participate in E-Verify" gets an "E-Verify" tag, which matters for STEM OPT.
5. A posting with an odd sentence, such as "sponsorship may be considered for exceptional candidates", gets "Unclear" with the sentence, and Priya decides.
6. Tracks applications the same way as Sam.

## Features and acceptance criteria

Each item lists checks you can run by hand or that tests cover. "Saved sample" means a real response saved to `test/fixtures`, with personal names removed.

### F1. Company list
`npm run companies` builds `data/companies.json` from the Simplify new-grad and internship listing files (downloaded at run time, not committed), plus `data/companies.extra.json` if present. The much longer MIT aggregator lists are added only with `--with-aggregator`.
- Each entry has `name`, `ats` (`greenhouse`, `lever`, `ashby`, later `workday`), `slug` (Workday: tenant, host number, site), and `sources`.
- The same board found in several lists appears once.
- Entries from `companies.extra.json` win over downloaded ones.
- The command prints counts per ATS and how many URLs could not be read as a board.
- A board marked dead (404 twice in a row on different days) is skipped by `collect` until the user clears the mark.

### F2. Collecting
`npm run collect` reads every board in the list, then writes `data/jobs.jsonl`, one job per line.
- Greenhouse, Lever and Ashby in the first version. Workday in a later slice.
- One request at a time per host, a pause between requests (default 1 s), retries on 429, 5xx and dropped connections after waits that grow each time (1 s, 3 s, 9 s, or longer when a `Retry-After` asks, up to a minute), so at most 4 tries, and a 30 s timeout that covers reading the whole answer. A site that cannot be reached for 5 boards in a row is skipped for the rest of the run, and a run where most boards failed keeps the earlier feed. One fixed, generic user agent, never rotated.
- A board that fails is listed in the summary with its status and is not retried in the same run. One failed board never stops the run.
- Jobs outside the United States are kept but tagged `country` so the default filters can hide them.
- Descriptions are stored as plain text. HTML tags and entities are removed.
- With `--board greenhouse:stripe` it collects one board, for trying things out.
- A second run the same day reuses cached board responses younger than the configured age (default 12 h) unless `--fresh` is given.

### F3. Reposts and duplicates
- The same posting listed under several locations (same company, same title, same description text) shows once, with all its locations.
- A job that keeps its id keeps its applied state across runs.
- A job reposted with a new id but the same company, title and description is linked to the old one, so its applied state carries over. The card says "Reposted, first seen <date>".

### F4. Work-authorization tags
Every job gets zero or more tags, each with the sentence that triggered it. When nothing triggered, it gets one tag, `not-stated`.
- Tag values: `citizen-only`, `us-person`, `clearance`, `no-sponsorship`, `no-future-sponsorship`, `no-visa-holders`, `sponsors`, `opt-cpt-welcome`, `e-verify`, `unclear`, `not-stated`.
- Each tag shows its evidence sentence. Clicking it shows the paragraph around it.
- A tag is never based on a sentence about another country (for example the Singapore sentence in the research appendix).
- Negated statements are read as negated: "unable to provide visa sponsorship" is `no-sponsorship`, never `sponsors`.
- Acronyms are matched only where the context fits: "CPT" next to "Cyber Penetration" is not `opt-cpt-welcome`, and "system optimization" is not STEM OPT.
- A phrase the rules recognise as being about work authorization but can't classify becomes `unclear`.
- The 60 postings in the research appendix are a test fixture. All 55 that were hand-checked as correct must come out with the right tag. The 5 marked wrong must not produce a restriction tag that would hide the job.

### F5. Effect on the user
Settings give one work-authorization status. Each tag has a fixed effect for each status: `blocked`, `likely-blocked`, `ok` or `positive`. The table is in `RESEARCH.md` section 5 and is kept as one data table in code.
- Default view hides `blocked` jobs and shows `likely-blocked` jobs with a warning. Both can be changed in settings.
- The header always shows how many jobs are hidden and why, and one click shows them.
- No job is ever removed from `jobs.jsonl` because of a tag.

### F6. H-1B history
Changed in `PLAN.md`: USCIS first. `npm run h1b` reads the USCIS H-1B Employer Data Hub CSV the user downloaded (path in settings) and writes `data/h1b.json`: per employer, the H-1B approvals for each fiscal year. DOL LCA data (wage levels and job titles) comes in a later slice; since the H-1B lottery is now weighted by wage level, wage level I counts matter for new grads.
- Company names are matched after normalising: case, punctuation, and endings like Inc, LLC, Corp, Ltd.
- `data/aliases.json` (hand-kept) maps a board name to a USCIS employer name when they differ.
- Each card shows the count, or "No H-1B approvals found for this employer", or "Several possible employers, not matched" when the match is ambiguous.
- History is never turned into a posting tag.
- The command prints the match rate (companies matched / companies with at least one US job).

### F7. Profile and resume
- Reads `data/profile.json`, checked with `validateProfile` from `@auto-applier/core`. An invalid profile stops with the error list, one per line.
- Optional `data/resume.txt` or `data/resume.pdf`: its text is scanned for skills from the skill list and added to the profile's skills for matching only. `profile.json` is not changed.
- Optional `--llm`: runs the core's `parseResume` with the user's Gemini or Groq key from `data/llm-settings.json` and writes `data/profile.draft.json` for the user to review. It never overwrites `profile.json`.

### F8. Matching
Each job gets a score from 0 to 100 and reasons.
- Reasons list matched skills, missing skills (named in the posting, not in the profile), whether the title matches a wanted role, and the level read from the title (intern, new-grad, entry, mid, senior, staff and above).
- Jobs whose level or location is outside the settings are filtered, not scored down, and are counted in the header like work-authorization filters.
- Two jobs with the same skills, title and level get the same score. The order of skills in the text does not matter.
- The skill list comes from O*NET Technology Skills (CC BY 4.0, credited in the README) plus `data/skills.extra.json` and the profile's own skills.

### F9. Feed page
`npm run feed` starts a local server on `127.0.0.1` only and prints its address.
- List of job cards: title, company, locations, posting date, score, tags with evidence, H-1B history, apply link.
- Filters: work authorization (as in F5), location, remote, level, role keywords, company, posted within N days, applied or not, minimum score.
- Search box over title, company and description.
- Sort by score or by date.
- "Applied" checkbox saves today's date. Unticking asks for confirmation and clears it. A status menu offers Saved, Applied, Interviewing, Offer, Rejected.
- Filters are remembered in the browser between visits.
- Works with JavaScript-built HTML that never uses `innerHTML` with job text, because job text comes from outside.
- With 5,000 jobs the page shows its first results in under 2 seconds on a laptop.

### F10. Applied history
- Stored in `data/applied.json`: job key, company, title, URL, status, date of each status change, optional note.
- Survives new collections and restarts. A job that disappears from the boards stays in the history marked "No longer listed".
- `npm run export-applied` writes a CSV.

### F11. Interface for the rest of the product
One function other packages call:

```ts
getJobs(settings: FeedSettings, profile: Profile, store: JobStore): Promise<RankedJob[]>
```

It returns every collected job with its tags, effects, score, reasons and history, ranked, and never drops jobs (filters are a separate `applyFilters` call). The shapes go in `PLAN.md`, and `INTEGRATION.md` explains how the extension would call it.

## Settings (`data/settings.json`)

| Setting | Values | Default |
|---|---|---|
| `workAuth.status` | `citizen`, `permanent-resident`, `f1-cpt`, `f1-opt`, `f1-stem-opt`, `h1b`, `other-needs-sponsorship` | required |
| `workAuth.needsSponsorshipLater` | true, false | true for F-1 statuses, false otherwise |
| `workAuth.stemDegree` | true, false | false |
| `workAuth.clearance` | `none`, `can-obtain`, `active` | `none` for non-citizens, `can-obtain` for citizens |
| `filters.hideBlocked` | true, false | true |
| `filters.hideLikelyBlocked` | true, false | false |
| `filters.countries` | list | `["US"]` |
| `filters.locations` | list of states, cities or "Remote US" | all |
| `filters.remoteOnly` | true, false | false |
| `filters.levels` | `intern`, `new-grad`, `entry`, `mid`, `senior`, `staff` | `new-grad`, `entry` |
| `filters.roles` | list of title keywords | required |
| `filters.excludeTitleWords` | list | `["senior", "staff", "principal", "manager"]` |
| `filters.postedWithinDays` | number | 90 (was 30; changed after the first real run, see NOTES) |
| `filters.companies.include` / `.exclude` | lists | empty |
| `filters.maxYearsRequired` | years | 2 (added in slice 6b) |
| `filters.myDegree` | `associate`, `bachelor`, `master`, `phd` | unset, so no job is hidden for its degree (added in slice 11b) |
| `filters.minScore` | 0 to 100 | 0 |
| `collect.delayMs` | number | 1000 |
| `collect.cacheHours` | number | 12 |
| `collect.atsList` | list | `["greenhouse", "lever", "ashby"]` |
| `h1b.lcaFile` | path to the DOL file | none |

An invalid settings file stops every command with the field name and a sentence saying what is allowed.

## Non-goals

- Applying, autofill or clicking Submit (the autofill branch).
- Rewriting resumes against postings (the later tailoring branch).
- LinkedIn, Indeed, Glassdoor, Handshake, or any site that needs a login or forbids scraping.
- iCIMS, Oracle Cloud, Taleo and in-house career sites in the first version.
- A server anyone else can reach, accounts, sync between devices, payments.
- Email or phone alerts.
- Jobs outside the United States as a target (they are collected and filtered out, not searched for).
- Advice about anyone's immigration status. Tags report what a posting says.
- Changes to `packages/core`, `packages/extension` or the root config. Anything needed there goes in `INTEGRATION.md`.

## Success criteria

Measured in Stage 5 on a real collection and reported with the numbers, pass or not.

| What | How it is measured | Target |
|---|---|---|
| Restriction tag precision | Hand-check 100 jobs: 50 with any restriction tag, 50 picked at random. For each restriction tag, is the sentence a real restriction that applies to this US job? | At least 95% correct |
| Restriction tag recall | In the same 100, find restrictions by reading the full text, and count the ones the tags missed | At least 90% found |
| Not stated | Of jobs tagged `not-stated` in the sample, how many really say nothing | At least 95% |
| Nothing lost | Jobs in `jobs.jsonl` = jobs shown + jobs hidden, per filter reason | Exactly equal |
| Company-name match to DOL | Companies with a matched DOL employer / companies with at least one US job. Hand-check 50 matches for correctness and 30 non-matches for missed ones | Report the rate; at least 95% of hand-checked matches correct |
| Match quality | For Sam and Priya's example settings, the top 20 jobs each: how many would they reasonably apply to (judged by you) | At least 15 of 20 |
| Collection time | Full run of Greenhouse, Lever and Ashby on a home connection, from an empty cache | Under 30 minutes for about 2,000 boards; report the real time |
| Politeness | Requests per host per second during the run, from the run log | Never more than 1 |
| Applied history | Tick 10 jobs, run a new collection, restart the server | All 10 still applied with their dates |

## Open questions

1. Is the status list in Settings right for your friends? For example, H-4 EAD or TN holders would fall under `other-needs-sponsorship` today.
2. The DOL download (252 MB) and USCIS data, from Stage 1, still need your OK before F6 is built.
3. From Stage 0: the comment style and whether `packages/jobs` may add dependencies. F7's PDF reading would reuse `pdfjs-dist`, which is already installed for the extension. Declaring it in `packages/jobs/package.json` would change the root lockfile.

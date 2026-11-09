# Job feed

Collects job postings from companies' own public job boards (Greenhouse, Lever, Ashby and Workday) onto your computer, and tags what each one says about work authorization, with the sentence as evidence. It ranks them against your own profile and settings, showing the skills you have and lack, on a local page where you can also track your applications. It also shows each employer's H-1B approvals from USCIS. See `docs/PLAN.md` for how it is built.

Nothing is sent anywhere except the requests to the job boards and to GitHub for the company lists. Everything it saves goes in `packages/jobs/data/`, which git ignores.

## How to run it

From the repository root, after `npm install`:

```bash
npm run companies -w @auto-applier/jobs
npm run collect -w @auto-applier/jobs
```

`companies` downloads Simplify's public new-grad and internship listing files and writes `data/companies.json`, one entry per job board. Add `-- --with-aggregator` to also include the much longer, mostly non-tech lists from job-board-aggregator (MIT).

To add or rename companies, create `data/companies.extra.json`:

```json
[
  { "ats": "ashby", "slug": "openai", "name": "OpenAI" },
  { "ats": "lever", "slug": "cirrus", "region": "eu", "name": "Cirrus Logic" }
]
```

The slug is the part of the board's address after the site name, such as `stripe` in `job-boards.greenhouse.io/stripe`. Run `companies` again after editing it.

`collect` reads every board in the list and writes `data/jobs.jsonl`, one job per line. Other options:

- `-- --board greenhouse:stripe --board lever:spotify` reads only those boards into `data/jobs.boards.jsonl`, leaving the full feed alone. Use `lever-eu:<slug>` for a Lever board in the EU.
- `-- --fresh` asks every board again instead of using answers saved in the last 12 hours.
- `-- --with-workday` also reads the Workday boards. Workday has no plain job list, so it searches each board for every role in `data/settings.json` and reads only jobs whose title holds a role. It skips jobs listed abroad and titles with your left-out words before asking for details. It still takes about 20 seconds a board, so all of them take hours: run it overnight, or name a few companies with `--board workday:<tenant>|<wdN>|<site>`. After changing roles, add `--fresh`.

It sends one request at a time to each job site, waits 1 second between requests, and retries after 1, 3 and 9 seconds when a site is busy, or longer if the site asks (up to a minute). A site that cannot be reached for 5 boards in a row is skipped for the rest of the run. If no board could be read, or more than half failed for reasons other than 404, the run stops with an error and keeps the earlier `jobs.jsonl`. Files are written to a temporary file first and swapped in when complete.

A board that returns 404 twice, at least 20 hours apart, is skipped from then on; delete its entry in `data/dead-boards.json` to try it again.

### Checking the work-authorization tags

```bash
npm run tags -w @auto-applier/jobs -- --status f1-opt
```

It tags every collected job in the US (or with no country), prints how often each tag appears and how many jobs are blocked, likely blocked, fine or a plus for that status, and writes `data/tag-check.json`, a fixed sample of 50 tagged and 50 random jobs with each tag's evidence sentence, for checking by hand. Statuses: citizen, permanent-resident, f1-cpt, f1-opt, f1-stem-opt, h1b, other-needs-sponsorship.

### Your best matches

Copy the examples and edit them (both stay in the git-ignored `data/` folder):

```bash
cp packages/jobs/data.example/settings.example.json packages/jobs/data/settings.json
cp packages/jobs/data.example/profile.example.json packages/jobs/data/profile.json
npm run top -w @auto-applier/jobs -- --limit 20
```

`profile.json` has the same shape as the profile the extension saves, so the same skills and education drive both. `settings.json` sets your work-authorization status and what to show: roles (title keywords), levels, places, how recent, companies to include or leave out, and a minimum score. `top` prints how many jobs are shown and why the rest were hidden, then each job with its score, the skills you have and lack, the work-authorization evidence and the link.

The score is 70 points for the share of the skills a posting names that are in your profile (counting at least three, so a posting that names one skill cannot score full marks), plus 30 if the title holds one of your roles. Jobs that ask for more years of experience than `maxYearsRequired` (default 2) are hidden; the years are read from phrases like "3+ years of experience", ignoring ones marked preferred. With `myDegree` set (for example `"master"`), jobs whose lowest required degree is higher are hidden; degrees marked preferred, listed under a preferred heading, or replaceable by experience do not count.

The chips over the cards change the filters for what you are looking at, without touching `data/settings.json`: posted within, years asked, pay, degree, workplace, job type and level. Your changes are kept in the browser, and the rest follow the settings file. Jobs whose board does not give a workplace, job type or pay (most Greenhouse jobs) are never hidden by those chips. "New since last visit" marks and keeps the jobs first seen since you last opened the page (a reload within half an hour counts as the same visit). If you are on STEM OPT, or on F-1 with `"stemDegree": true`, jobs at E-Verify employers that nothing else blocks say "E-Verify employer: STEM OPT can work here", and an "E-Verify only" chip keeps just the E-Verify employers. A posting that uses E-Verify only "in certain locations" gets its own tag, `e-verify-some-places`, which shows its sentence but is not a plus and gets no badge, since your job's place may not be one of them.

### The feed page

```bash
npm run feed -w @auto-applier/jobs
```

It reads the jobs once (about two minutes for the full list), then serves a page at http://127.0.0.1:4317, reachable only from this computer. Only that page can use the server: requests that name another host, come from another site's page, or change data without JSON and the token the server writes into the page are refused, so a website you visit cannot read or change your history or settings. Each card shows the score, the skills you have and lack, the years asked for, and the work-authorization tags; click a tag to read the sentences it came from. The summary line counts the hidden jobs by reason, and clicking a reason lists them greyed out. Search, filter and sort at the top; the page remembers your choices in this browser.

The "Settings" panel at the top of the page edits `data/settings.json`: work-authorization status, sponsorship later, STEM degree, clearance, roles (a list of common ones plus your own), levels, places, remote only, how recent, years asked and your degree. Saving checks the settings, writes the file and ranks the jobs again without reading them again; a mistake is shown under the button and nothing changes. Settings the panel does not show (title words to leave out, companies, minimum score, pay, workplace and job type) are kept as they are. "Remote only" keeps a job when its board marks it remote (Ashby and Lever say so) or one of its places says remote. Without a `settings.json` the feed still starts, opens the panel and shows jobs once you save. Skills stay in `profile.json`.

The menu on each card tracks your application: saved, applied, interviewing, offer or rejected, with the date of each change, kept in `data/applied.json`. To get a spreadsheet:

```bash
npm run export-applied -w @auto-applier/jobs
```

### H-1B history

Download the full table from the USCIS H-1B Employer Data Hub (one fiscal year, about 100 MB) to `data/h1b/h1b-employers-fy2026.csv`, then:

```bash
npm run h1b -w @auto-applier/jobs
```

It adds the file up per employer into `data/h1b.json`, matches the collected companies by name, prints the match rate and lists unmatched names in `data/h1b-unmatched.txt`. To fix a name, add it to `data/aliases.json` (see `data.example/aliases.example.json`), for example `{"SpaceX": "SPACE EXPLORATION TECHNOLOGIES CORP"}`. `top` and the feed page then show, next to the tags, how many H-1B petitions USCIS approved for that employer and how many were for new employment. This is the employer's history, not a promise about the posting.

## What it took on 2026-11-04

1,931 boards, 17 minutes from an empty cache, 98,179 postings, which became 90,254 jobs after joining copies (60,311 in the US). 96 boards returned 404. The saved answers took 1.2 GB and the jobs file 564 MB. A run from the saved answers took 20 to 75 seconds.

## Known limits

- Greenhouse, Lever and Ashby, plus Workday with `--with-workday`. iCIMS, Oracle, Workday's myworkdaysite.com pages and company-built career sites are not read.
- Lever and Ashby boards do not give the company name, so a board added with `--board` shows its slug.
- The country is read from location text. About 7% of jobs say only "Remote" or name a place it does not know, and are left undecided.
- Copies of a posting are joined into one job only when they are listed at different places and their text is the same apart from the place and any dates. Copies with different pay or experience stay separate. A joined job lists every copy's own link in `copies`.
- A posting reposted under a new id is linked to its earlier copy if that copy was seen in the last 60 days (`data/seen.json`) and is no longer listed.
- The commands keep everything in memory during a run (about 1.4 GB at most for the full list), so the much longer aggregator lists may not fit.
- `npm ci` fails on this branch until the root lockfile lists this package; `npm install` works.
- Tags are rules over sentences, not a model. A hand check of 100 jobs (before the last fixes) found 2 wrong restriction tags out of 47 and no missed restriction. Each tag shows its sentence so you can judge it. Tags describe what a posting says; they are not advice about anyone's status.
- Years of experience are read only from phrases with a number, so "several years" or a requirement written another way is missed. Most titles state no level.
- The same posting on two of a company's boards is joined only when the title and text match apart from punctuation, dates and places.
- `postedWithinDays` defaults to 90, because Greenhouse dates a job from when it was first published and many postings stay open for months. A posting older than that may still be open.
- The page ranks the jobs when `feed` starts, so after a new `collect`, stop it and start it again.
- H-1B history matches 40% of companies with US jobs by name. "No approvals found" can mean the company files under another legal name. Matches made by a similar name (Notion to NOTION LABS INC) are marked for checking and were right about 85 to 90% of the time in a hand check.

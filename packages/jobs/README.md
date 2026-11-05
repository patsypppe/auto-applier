# Job feed

Collects job postings from companies' own public job boards (Greenhouse, Lever and Ashby) onto your computer, and tags what each one says about work authorization, with the sentence as evidence. It ranks them against your own profile and settings, showing the skills you have and lack. A page to browse them and an applied tracker come in later steps; see `docs/PLAN.md`.

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

- `-- --board greenhouse:stripe --board lever:spotify` reads only those boards into `data/jobs.boards.jsonl`, leaving the full feed alone.
- `-- --fresh` asks every board again instead of using answers saved in the last 12 hours.

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

The score is 70 points for the share of the skills a posting names that are in your profile, plus 30 if the title holds one of your roles.

## What it took on 2026-11-04

1,931 boards, 17 minutes from an empty cache, 98,179 postings, which became 90,254 jobs after joining copies (60,311 in the US). 96 boards returned 404. The saved answers took 1.2 GB and the jobs file 564 MB. A run from the saved answers took 20 to 75 seconds.

## Known limits

- Only Greenhouse, Lever and Ashby. Workday is planned; iCIMS, Oracle and company-built career sites are not.
- Lever and Ashby boards do not give the company name, so a board added with `--board` shows its slug.
- The country is read from location text. About 7% of jobs say only "Remote" or name a place it does not know, and are left undecided.
- Copies of a posting are joined into one job only when they are listed at different places and their text is the same apart from the place and any dates. Copies with different pay or experience stay separate. A joined job lists every copy's own link in `copies`.
- A posting reposted under a new id is linked to its earlier copy if that copy was seen in the last 60 days (`data/seen.json`) and is no longer listed.
- The commands keep everything in memory during a run (about 1.4 GB at most for the full list), so the much longer aggregator lists may not fit.
- `npm ci` fails on this branch until the root lockfile lists this package; `npm install` works.
- Tags are rules over sentences, not a model. A hand check of 100 jobs (before the last fixes) found 2 wrong restriction tags out of 47 and no missed restriction. Each tag shows its sentence so you can judge it. Tags describe what a posting says; they are not advice about anyone's status.
- A posting that names only one known skill scores full marks if you have it, so short postings can outrank detailed ones. Years of experience are not read yet, and most titles state no level, so some top jobs expect more experience than a new graduate has.
- The default `postedWithinDays` of 30 hides many jobs that are still open, because Greenhouse dates a job from when it was first published.

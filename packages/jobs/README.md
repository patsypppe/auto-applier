# Job feed

Collects job postings from companies' own public job boards (Greenhouse, Lever and Ashby) onto your computer. Matching them to your resume, work-authorization tags, a page to browse them and an applied tracker come in later steps; see `docs/PLAN.md`.

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

- `-- --board greenhouse:stripe --board lever:spotify` reads only those boards.
- `-- --fresh` asks every board again instead of using answers saved in the last 12 hours.

It sends one request at a time to each job site, waits 1 second between requests, and retries after 1, 3 and 9 seconds when a site is busy. A board that returns 404 on two different days is skipped from then on; delete its line in `data/dead-boards.json` to try it again.

## What it took on 2026-11-04

1,931 boards, 17 minutes from an empty cache, 98,179 postings, which became 87,820 jobs after joining copies. 96 boards returned 404. The saved answers took 1.2 GB and the jobs file 597 MB. A second run from the saved answers took about a minute.

## Known limits

- Only Greenhouse, Lever and Ashby. Workday is planned; iCIMS, Oracle and company-built career sites are not.
- Lever and Ashby boards do not give the company name, so a board added with `--board` shows its slug.
- The country is read from location text. About 7% of jobs say only "Remote" or name a place it does not know, and are left undecided.
- Copies of a posting in several cities are joined into one job only when their text is the same apart from the city and any numbers. A joined job shows the text of its lowest-id copy, so a pay range that differs by city shows only that copy's range.
- A posting reposted under a new id is linked to its earlier copy if that copy was seen in the last 60 days (`data/seen.json`).
- `npm ci` fails on this branch until the root lockfile lists this package; `npm install` works.

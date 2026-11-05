# Stage 5: real-data check

Run on 2026-11-05 on one laptop, with the made-up example profile (MS Statistics, F-1 OPT) in data.example/. Every number
below comes from a command run that day; the commands are listed with each part.

## 1. Fresh collection

`node dist/cli.js collect --fresh` (Greenhouse, Lever and Ashby; Workday stays opt-in), timed with `/usr/bin/time -l`.

| | |
|---|---|
| Boards read | 1,833 of 1,929 (Greenhouse 823 of 863, Lever 314 of 340, Ashby 696 of 726) |
| Failures | 96, all 404 (board moved or closed); no timeouts, no 429s, no 5xx |
| Postings | 97,909, which became 89,757 jobs after joining copies; 36 reposts linked |
| Time | 1,038 s of collecting, 1,069 s in all (about 18 minutes) |
| Peak memory | 1.7 GB |
| Requests | 1,929 (863 Greenhouse, 336 Lever US, 4 Lever EU, 726 Ashby) |
| Pacing | Smallest gap between two requests to the same host: Ashby 1.022 s, Greenhouse 1.055 s, Lever 1.041 s, Lever EU 2.837 s |

The pacing numbers come from the request log lines written during the run (data/requests.log, lines 2,964 to 4,892).
No host was asked more than once a second.

A second run straight after, using the 12-hour cache, took 58 s and gave the same 89,757 jobs.

Known cost: peak memory is 1.7 GB because the whole jobs file (562 MB) is held while joining copies. It fits on a
laptop, but it is the first thing to fix if the board list grows. A one-off script that read the file in one string
also failed (Node's string limit is 512 MB); the package's own reader goes line by line and is not affected.

## 2. Work-authorization tags, 100 jobs by hand

`node dist/cli.js tags` wrote data/tag-check.json: 50 jobs that have a restriction or sponsorship tag, and 50 jobs at
random from the 66,549 jobs in the US or with no country. I read each tag's sentence, and for the random 50 every
sentence in the full text that mentions visas, sponsorship, citizenship, authorization, clearance or export control.

Tag counts over the 66,549 jobs: not-stated 44,271, us-person 7,125, clearance 6,976, unclear 5,778, no-sponsorship
3,267, e-verify 3,151, citizen-only 1,555, no-future-sponsorship 1,216, sponsors 1,052, opt-cpt-welcome 72.

**Restriction tags** (citizen-only, us-person, clearance, no-sponsorship, no-future-sponsorship): 51 of 56 right (91%).
The earlier check in RESEARCH.md had 95.7% on 47 tags; the new misses are patterns that sample did not have.

| Wrong tag | Why | Jobs with the pattern (of 66,549) |
|---|---|---|
| no-sponsorship on Cloudflare and Mach Industries | "without sponsorship for an export license" is about export licenses, not visas | 441 |
| clearance on Anduril (Contracts Manager) | "Preference for a Top Secret clearance" | 477 with "preferred" or "not required" near "clearance" |
| clearance on Shield AI (W21) | "clearance is preferred; a clearance is not required" | (same 477) |
| clearance on Appian | "eligible for a government clearance differential" is about pay | not counted |

For an F-1 user, the Cloudflare one matters: it moves the job from "ok" to "likely blocked". The other four jobs had a
second right restriction tag, so their effect did not change.

**Restrictions missed** (5 jobs):

| Job | Sentence | Given |
|---|---|---|
| US Conec | "Individuals with temporary visas such as E, F-1, H-1 ... are not eligible for hire" | unclear (no-sponsorship was also found, so still likely blocked; should be blocked) |
| Inductive Automation | "unable to offer employment for ... those who require sponsorship" | unclear |
| CGS Federal, Law Clerk II | "- U.S. Citizenship." as a requirement line | unclear |
| STR, Principal Product Lead | "Citizen with the ability to obtain a Security Clearance" | clearance only |
| Anduril, Sourcing Engineer | "TS clearance" as a bare requirement line | not-stated |

Patterns over all 66,549 jobs: temporary visas named as not eligible 189, "unable to ... require sponsorship" 17, bare
"TS/Secret clearance" lines 151.

**Sponsorship missed** (1 job): Think Academy "Visa Sponsorship: H1B Available" was tagged unclear, not sponsors.

**Not stated**: 27 of the 29 random jobs tagged not-stated had nothing to say. The other two: the bare "TS clearance"
line above, and ibotta's "must be currently authorized to work in the United States on a full-time basis", which
should be unclear.

**Unclear on the wrong sentence** (not restrictions, but noise on the card): Axle (a duty about H-1B paperwork) and
Rivian (a fair-employment line).

## 3. Years of experience, 40 jobs

40 jobs at random (fixed seed) from the 9,847 US jobs whose title names data, analyst, science, machine learning,
software engineer or statistics. For each I printed every "N years" phrase in the text next to what yearsRequired read.

- 25 of the 40 state years. 20 of the 25 were read right.
- None of the 15 without a years phrase got a number.
- The reader never gave a number that was too high; every mistake was a miss, which leaves the job shown.

| Missed | Phrase |
|---|---|
| Axon, Senior Data Scientist | "6+ years in product analytics or a closely related role" (the role word is more than 40 characters on) |
| Meridian Link, Sr AI Engineer | "5+ years building, scaling, and running production software" |
| Mill, Program Manager | "8+ years of SW program management" |
| FS Studio, Principal Engineer | "15+ years in spacecraft, mission control ..." |
| Affirm, Senior Engineer | "5+ years of experience running Kubernetes ... ideally Amazon EKS" ("ideally" later in the sentence made it look optional) |

One more is debatable: Latitude AI asks for "4+ years (or Master's degree and 2+ years)". The reader takes 4; for an MS
user the answer is 2.

All five misses are hidden anyway: four by the excluded title words, and the "Sr AI Engineer" by its level, since the
level reader already reads "Sr" as senior and the default levels leave senior out.

Not covered by the reader: years written as words ("two years of"), in 426 of the 9,847 jobs.

## 4. H-1B history and the top 20

`node dist/cli.js h1b`: 1,676 companies with US jobs, 667 matched (40%): 545 exact, 120 by a similar name, 2 by alias;
54 ambiguous, 955 with no filings found. Same as the first run in slice 9.

`node dist/cli.js top` with the example profile: 146 of 89,757 jobs shown. Hidden: role 51,904, abroad 23,208,
blocked 13,882, title-word 324, experience 124, old 88, level 81. Shown plus hidden is 89,757, so no job is lost.

The top 20 are all data, analyst, data science or machine learning jobs in the US. Of the 12 with an H-1B line, every
matched name is the same company as the posting (OpenAI Opco, Notion Labs, Palantir Technologies, Figma, The New York
Times Company and so on). Things a user would notice:

- Four Integra FEC intern postings (Spring and Summer, analyst and PhD) take ranks 3 to 6. They are different openings,
  not copies, but they are all likely blocked for an F-1 user and still rank above jobs that are ok.
- Two of the 20 are PhD internships, which an MS student cannot take. There is no degree filter yet.
- Point72, IMC and Fin show no match or an ambiguous one; they probably file under another legal name (unverified).
  These are what data/aliases.json is for.

## 5. Application history

Against the running server on the fresh data:

1. Set one job to applied with a note, another to saved then applied.
2. Added a history entry for a job that is no longer listed, then changed its status to interviewing through the page's API.
3. Ran `collect` again (rewrites jobs.jsonl). applied.json had the same checksum before and after; only the feed server and
   export-applied read or write it.
4. Restarted the server. All three jobs came back with every status change, its date and the note.
5. `export-applied` wrote all 3 to a CSV.

The history was emptied again afterwards.

## What to fix, in order

1. Do not read "sponsorship for an export license" as a visa refusal (441 jobs, and it can block an F-1 user wrongly).
2. Treat "preferred" or "not required" near "clearance" as not a restriction (477 jobs).
3. Read "temporary visas such as ... F-1 ... are not eligible" as blocked for F-1, CPT, OPT and STEM OPT (189 jobs).
4. Read bare requirement lines: "TS clearance", "U.S. Citizenship", "Citizen with the ability to obtain".
5. Rank likely-blocked jobs below ok ones for the same score.
6. Years: allow a longer gap before the role word, accept "N+ years building/running ...", and only treat "ideally" as
   optional when it comes before the years.

## Fixes made after the check

Each fix has a test with the wording from the real posting. 520 tests pass and the typecheck is clean. Every job's tags
were then compared before and after on the 66,549 US jobs, and the changed sentences were read.

| Fix | Change on the real data |
|---|---|
| "Sponsorship for an export license" is no longer read as a visa refusal | 441 no-sponsorship tags removed, all of them this sentence (Cloudflare, Mach Industries, Cylake and others) |
| A clearance that is only preferred, desired, a plus, not required, or a pay differential is not a rule. Each comma-separated clause is read on its own, and a bracketed wish such as "(active clearance preferred)" is left out, so "security clearance (active clearance preferred)" and "Active Top-Secret Clearance, preferred with SCI eligibility" still count | Of the 7,027 jobs with "clearance" and one of those words, 211 lost the tag. The removed sentences that also say "must" or "required" were all read: the requirement was about citizenship or U.S. person status, which keep their own tags. One stays a miss: "strongly preferred ...; at minimum, must be eligible to obtain one" |
| "TS clearance" and "Secret level clearance" are read as clearances | 164 more clearance tags, mostly Anduril's "Ability to obtain and maintain a U.S. TS clearance" |
| Bare requirement lines "U.S. Citizenship" and "Citizen with the ability to obtain ..." are citizens only | 80 more citizen-only tags |
| New tag no-visa-holders: temporary visas such as F-1 named as not eligible. Blocked for F-1 CPT, OPT and STEM OPT, H-1B and anyone needing sponsorship; fine for citizens and permanent residents | 190 jobs (Protolabs, US Conec, WorldStrides, GCM Grosvenor and others) |
| "Unable to offer employment / consider candidates ... who require sponsorship" is a refusal | 13 no-sponsorship (Inductive Automation) and 4 no-future-sponsorship (Beghou Consulting, which was wrongly tagged sponsors before) |
| "Visa sponsorship: Available" is an offer | 3 more sponsors |
| Equal scores: fine jobs before likely-blocked ones, then newer first | Notion moves above the four Integra FEC internships |
| Years: "3+ years" or "at least 3 years" also counts before "of", "in" or a verb ("8+ years of SW program management", "5+ years building ..."); a wish word counts only before the years or right after them ("5+ years of Python preferred"), so "..., ideally Amazon EKS" no longer drops the requirement; "18+ years of age" and "years ago" are not experience | All 5 misses in the 40-job sample are read now, and no other job in it changed. Over the 9,847 data and engineering jobs, 865 now get a number and 53 get a different one; 25 of them read by hand were all real requirements |

Not changed: the "Sr" fix in the first list (not needed, see part 3), ibotta's "authorized to work ... on a full-time
basis" (still not stated), and the two unclear tags on the wrong sentence (Axle, Rivian).

After the fixes, with the example profile:

| | Before | After |
|---|---|---|
| no-sponsorship | 3,267 | 2,839 |
| clearance | 6,976 | 6,931 |
| citizen-only | 1,555 | 1,635 |
| no-visa-holders | none | 190 |
| unclear | 5,778 | 5,524 |
| For F-1 OPT: blocked | 13,882 | 14,017 |
| For F-1 OPT: likely blocked | 2,831 | 2,457 |
| Shown | 146 | 135 |

Shown plus hidden is still 89,757.

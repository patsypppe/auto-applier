# Job feed research

Written 2026-11-04. Every test call below was run from a laptop on that day with `curl` or Python's `urllib`, one request at a time with a 1 second pause. Raw responses were kept outside the repo. "Unverified" means I could not check the claim myself.

## 1. What similar tools show

| | Simplify | Jobright | Tsenta |
|---|---|---|---|
| Matching | Match % on each listing plus the resume keywords you are missing (one test: 33%, "4 of 12 keywords") [1] | Match % labelled Strong / Good / Fair, broken into Experience Level, Skill and Industry Experience [2] | Match % with no breakdown [3] |
| Sponsorship | "Sponsors H1B" / "Does not sponsor H1B" labels and an H1B checkbox filter [2] | "H1B Sponsored" (the posting says so), "H1B Sponsor Likely" (company sponsored similar roles recently), "No H1B" [2] | Work-authorization filter covering OPT, STEM OPT and H-1B, with a note that it cannot guarantee a company's policy [4] |
| Other filters | Dealbreakers: sponsorship, salary floor, location [1] | Exclude Security Clearance, Exclude US Citizen Only, saved filters, posting age, applicant count [2] | Location [3] |
| Tracking | Kanban board: Saved, Applied, Interviewing, Offer; auto-logged from the autofill [1] | Job tracking on free and paid plans [2] | Tracker plus a receipt per application [3] |

What users praise: Simplify's free tracker and autofill on Greenhouse and Lever forms [1]; Jobright's H-1B filter is the feature reviewers recommend most [5].

What users complain about:
- Match scores that don't track outcomes. One reported Jobright score went from 9.0 to 4.0 on a rerun [5]. A Tsenta test matched a senior data scientist to intern roles at 73 to 77% [3].
- Stale or off-field jobs [5], and a location filter that let other cities through [3].
- Billing and refund problems on paid plans for all three [1][3][5].
- Sponsorship labels come from company history, not from the posting. "Likely" does not mean this role sponsors [5].

Caveat: Reddit itself could not be fetched with my tools (its robots rules block them), so the complaints above are second-hand through review sites. Several of those sites sell competing tools.

Worth copying:
1. Jobright's split between "the posting says X" and "the company has a history of Y". That is the same as our evidence-sentence tag plus a separate DOL history signal.
2. Exclude-clearance and exclude-citizen-only as two separate filters, because they affect permanent residents differently (section 5).
3. Simplify's "matched / missing skills" list instead of an opaque score.
4. A plain four-stage tracker. Applied with a date is enough to start.

Not worth copying: a single headline percentage, which reviewers repeatedly say misleads.

## 2. Job sources

All of these answered without a key. Sizes are the full response with descriptions.

| Source | URL pattern | Test calls (status, bytes, jobs) | Description in list? | Pagination | CORS |
|---|---|---|---|---|---|
| Greenhouse | `GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true` | stripe 200, 5.9 MB, 757; airbnb 200, 3.0 MB, 207; databricks 200, 10.1 MB, 928 | Yes with `content=true` (HTML, entity-escaped). Without it, stripe was 0.47 MB | None, one response holds every job (`meta.total`) | `*` |
| Lever | `GET https://api.lever.co/v0/postings/{slug}?mode=json` | palantir 200, 6.0 MB, 309; spotify 200, 0.8 MB, 85; plaid 404 (not on Lever) | Yes (`descriptionPlain`, `lists`, `additionalPlain`) | `skip`, `limit` | `*` |
| Ashby | `GET https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true` | openai 200, 14.3 MB, 813; ramp 200, 3.1 MB, 169; notion 200, 2.7 MB, 146 | Yes (`descriptionPlain`, `descriptionHtml`) | None | `*` (and `cache-control: max-age=60`) |
| SmartRecruiters | `GET https://api.smartrecruiters.com/v1/companies/{id}/postings?limit=100&offset=N`, then `.../postings/{postingId}` for text | ServiceNow 200, 745 total; BoschGroup 200, 5,004 total; Visa 200 but 0 jobs | No. Text needs one call per posting (`jobAd.sections`) | `limit` (100 worked), `offset`, `totalFound` | `*` |
| Workday | `POST https://{tenant}.wd{N}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs` with `{"limit":20,"offset":0,"searchText":"","appliedFacets":{}}`, then `GET .../job/{externalPath}` | nvidia 200, total 2,000; salesforce 200, 1,548; adobe 200, 278. `limit: 50` returned 400 | No. Title, `locationsText`, `postedOn` ("Posted Today") only | 20 per page; community reports say results stop near 2,000 [6] | Preflight returned 404, so a plain web page cannot call it |
| Recruitee | `GET https://{slug}.recruitee.com/api/offers/` | bunq 200, 24 offers | Yes | None | not checked |
| Workable | `GET https://apply.workable.com/api/v1/widget/accounts/{slug}` | huggingface 200, 6 jobs | No | None | not checked |

Fields worth keeping: Greenhouse `id, title, absolute_url, location.name, offices, departments, updated_at, first_published, content, metadata`; Lever `id, text, hostedUrl, categories.{location,commitment,team,allLocations}, country, workplaceType, createdAt, descriptionPlain`; Ashby `id, title, jobUrl, location, secondaryLocations, address, isRemote, workplaceType, employmentType, publishedAt, isListed, descriptionPlain, compensation`.

Rate limits and terms:
- Greenhouse: "authentication is not required for any GET endpoints." No rate limit is stated [7]. Response headers carried no rate-limit fields.
- Lever: only application POSTs are limited (2 per second). It says "all job postings in the published state are publicly viewable" [8].
- Ashby: the docs give the endpoint and `includeCompensation` and say nothing about limits or terms [9].
- SmartRecruiters: the docs describe key or OAuth authentication [10], but keyless reads worked on 2 of 3 companies. Treat that as able to change without notice.
- Workday: no public documentation. The endpoint is what the career site itself calls. Behavior comes from community write-ups [6]. Terms unverified.
- I found no terms page from any of these vendors that forbids reading the public board feed. I also found none that allows it. Unverified either way.

Ranking for US tech and data jobs, by how many companies in the Simplify new-grad list use each ATS (section 3) and how cheap each is to read:
1. Greenhouse: 577 companies, full text in one call, documented.
2. Ashby: 467, full text in one call, documented.
3. Lever: 230, full text in one call, documented.
4. Workday: 1,211 companies, the largest share. Undocumented, 20 jobs per page, and one call per job for the text. Worth adding after the first three work.
5. SmartRecruiters: 170, one call per job for the text.
6. Skip for now: iCIMS (234), Oracle Cloud, Workable (157, no text in the list), and in-house sites (TikTok, Tesla, Apple). LinkedIn and Indeed forbid scraping in their terms, so JobSpy-style collection is out.

Cost of a full run, measured: 66 random boards from the Simplify list took 103 s with 1 s pauses and came to 40 MB with descriptions. Scaled to about 2,150 Greenhouse, Lever and Ashby boards, that is about 55 minutes and 1.3 GB if run one at a time. With one queue per host (three in parallel) it would be about 20 minutes. Fetching lists without descriptions first and asking for text only for jobs that pass the filters would cut most of the volume. That is an estimate, not a measurement.

## 3. Company lists

| List | What it has | Size | Freshness | License |
|---|---|---|---|---|
| [SimplifyJobs/New-Grad-Positions](https://github.com/SimplifyJobs/New-Grad-Positions) `.github/scripts/listings.json` | Listings with `company_name`, `url`, `locations`, `sponsorship`, `active`, `date_posted` | 19,064 listings, 3,925 companies (3,076 active) | Updated 2026-11-04 | None stated |
| [SimplifyJobs/Summer2027-Internships](https://github.com/SimplifyJobs/Summer2027-Internships) same path | Same plus `terms` | 17,640 listings, 3,182 companies (5,139 active) | Updated 2026-11-04 | None stated |
| [Riley-Dorrington/job-board-aggregator](https://github.com/Riley-Dorrington/job-board-aggregator) `data/*_companies.json` | Plain slug lists per ATS; Workday as `tenant\|wdN\|site` | Greenhouse 8,333; Lever 4,368; Ashby 3,161; Workday 12,884 | Greenhouse list last changed 2026-06-16 | MIT |

From both Simplify files I pulled board slugs out of the job URLs with regular expressions. That gave 867 Greenhouse, 339 Lever, 727 Ashby, 218 SmartRecruiters and 1,682 Workday (tenant, host, site) combinations. Random checks against the live APIs: Greenhouse 10 of 10 answered, Lever 9 of 10, Ashby 10 of 10. In a second sample of 75 boards, 9 returned 404. Expect about 10% of slugs to be dead at any time.

Simplify's `sponsorship` field is set on only 27 of about 8,200 active listings, so it is not usable as ground truth.

The Simplify repos have no license, so their files should not be copied into our repo. Downloading them on the user's machine and keeping only (company, ATS, slug) is reading public facts. That is my judgment, not legal advice. The aggregator's lists are MIT and can be copied with the notice.

## 4. Open-source projects

| Project | What it does well | License | Reuse code? |
|---|---|---|---|
| [job-board-aggregator](https://github.com/Riley-Dorrington/job-board-aggregator) | Python scrapers for 7 ATSs, a dedupe key (job id, else company + title), drops jobs older than 30 days, localStorage applied tracking | MIT | Yes with notice. Don't copy its rotating fake user agents (it picks a random browser string per request), which is evasion |
| [JobSpy](https://github.com/speedyapply/JobSpy) | Scrapes LinkedIn, Indeed, Glassdoor and others | MIT | Code yes, but its sources forbid scraping, so no |
| [AIHawk](https://github.com/feder-cr/Jobs_Applier_AI_Agent_AIHawk) | Resume-to-jobs agent that drives a browser | MIT | Ideas only. It automates applying, which is out of scope |
| [Resume-Matcher](https://github.com/srbhr/Resume-Matcher) | Resume vs job description keyword and LLM comparison | Apache-2.0 | Ideas for the later tailoring branch |
| [JobFunnel](https://github.com/PaulMcInnis/JobFunnel) | Scrapes to a spreadsheet with dedupe | MIT, archived | Dedupe ideas only |
| [transformers.js](https://github.com/huggingface/transformers.js) with [all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) | Runs sentence embeddings (384 numbers per text) locally in Node or the browser | Apache-2.0 | Yes, if embeddings are ever added |

## 5. Work authorization

### What postings actually say

I scanned 12,802 postings from 80 boards: 14 chosen because they were large or defense-related, plus 66 picked at random from the Simplify list. The share of postings with each kind of statement (one big board like SpaceX can tilt these numbers):

| Statement | Postings | Boards with any |
|---|---|---|
| No sponsorship | 96 (0.75%) | 10 |
| Sponsorship offered | 0 | 0 |
| U.S. citizenship required | 128 (1.0%) | 10 |
| ITAR / U.S. person / export control | 4,709 (36.8%) | 10 |
| Security clearance | 2,373 (18.5%) | 12 |
| E-Verify | 426 (3.3%) | 6 |
| OPT / CPT / STEM OPT welcome | 0 | 0 |

Takeaways:
- **Most postings say nothing.** Outside defense and space companies, almost no posting mentions work authorization. The default tag has to be "not stated", and the employer's H-1B history (section 6) has to carry most of the signal for international students.
- No posting in the sample said OPT or CPT was welcome, and none offered sponsorship in plain words. So "OPT welcome" cannot be a tag we expect to see often.
- Keyword matching alone is wrong in predictable ways. "system optimization" matched "STEM OPT". "CPT" was "Cyber Penetration Teams". "EAR" matched "a strong ear for phrasing". "sponsor" matched "technical sponsor" and "OpenAI will sponsor the clearance process". "We are unable to provide visa sponsorship" matched a naive "provide visa sponsorship" pattern. Splitting sentences on "." broke "U.S." into two sentences. Each needs a rule: case-sensitive acronyms with context, a negation check, and a sentence splitter that knows "U.S.".
- Location matters. "Unable to provide work visa sponsorship ... Singapore" is about Singapore. Databricks puts the same export-control paragraph on Berlin, Bengaluru and Sydney jobs.

The appendix lists 60 real postings with the exact phrase and my hand check: 55 were tagged correctly and 5 were wrong.

### Which statuses each phrase affects

| Phrase type | Typical wording (from the appendix) | Citizen | Permanent resident | F-1 CPT/OPT/STEM OPT | Needs H-1B now or later |
|---|---|---|---|---|---|
| No sponsorship | "We are unable to provide visa sponsorship", "authorized to work ... without visa sponsorship or transfer" | OK | OK | Usually blocked for anyone who will need H-1B later. Some employers still hire OPT students under "no sponsorship", so mark as "likely blocked", not "blocked" | Blocked |
| No sponsorship "now or in the future" | "now or in the future" | OK | OK | Blocked (OPT ends) | Blocked |
| U.S. citizenship required | "U.S. Citizenship required", "Must be a U.S. citizen" | OK | Blocked | Blocked | Blocked |
| U.S. person (ITAR/EAR) | "Must be a U.S. Person ... (U.S. citizens, Green Card holders, lawful permanent residents, or individuals granted asylum or refugee status)" | OK | OK | Blocked | Blocked |
| Security clearance | "Active Secret security clearance", "ability to obtain TS/SCI" | OK | Blocked in practice (clearances are for citizens; source still to fetch: Executive Order 12968, unverified) | Blocked | Blocked |
| E-Verify participation | "Notice of E-Verify Participation" | No effect | No effect | Required for STEM OPT, so its presence keeps STEM OPT possible | No effect |
| OPT/CPT welcome | (none found) | No effect | No effect | Positive | Not a promise of H-1B |

### What OPT, STEM OPT, CPT and E-Verify mean for an employer

- **OPT**: temporary employment "directly related to an F-1 student's major", up to 12 months per degree level, before and/or after graduation. The student applies with Form I-765 after the school recommends it. The employer files nothing [11]. The student cannot start until the Employment Authorization Document (EAD) arrives [11].
- **STEM OPT**: a 24-month extension for degrees on the DHS STEM list. The employer must be "enrolled in E-Verify", have an EIN, sign the Form I-983 training plan, keep a "bona fide employer-employee relationship", offer duties, hours and pay "commensurate with those of similarly situated U.S. workers", and report the student leaving within 5 business days [12]. So staffing-agency placements and unpaid roles usually do not qualify.
- **CPT**: "integral to your major", authorized by the school's designated official on a new I-20, needs a cooperative agreement or employer letter. "If you have 12 months or more of full-time CPT, you are ineligible for OPT" [13].
- **E-Verify**: "compares information entered by an employer from an employee's Form I-9 ... to records available to" DHS and SSA "to confirm employment eligibility" [14]. Whether it is voluntary depends on state law and federal contracts. I did not confirm that from an official page (unverified).
- ICE's page shows a banner about a DHS final rule from July 17, 2026 that sets a fixed admission period for F students [13]. I have not read the rule, so I don't know whether it changes OPT (unverified).

## 6. H-1B sponsorship history (DOL LCA data)

- Download page: [DOL OFLC Performance Data](https://www.dol.gov/agencies/eta/foreign-labor/performance), section "LCA Programs (H-1B, H-1B1, E-3)". Files are cumulative for the fiscal year (October to September).
- Sizes checked with HEAD requests from the page: FY2026 Q3 `LCA_Disclosure_Data_FY2026_Q3.xlsx` is 251,850,891 bytes (about 252 MB), dated 2026-08-07, covering 2025-10-01 to 2026-06-30. FY2025 Q4 is 79 MB. Excel only, no CSV. The site blocks `curl` with 403, so a script needs a browser-like client or a manual download.
- Useful columns, from the FY2026 record layout PDF: `CASE_STATUS` (Certified, Certified - Withdrawn, Denied, Withdrawn), `DECISION_DATE`, `VISA_CLASS` (H-1B, E-3 Australian, H-1B1 Chile/Singapore), `JOB_TITLE`, `SOC_CODE`, `SOC_TITLE`, `FULL_TIME_POSITION`, `BEGIN_DATE`, `TOTAL_WORKER_POSITIONS`, `NEW_EMPLOYMENT`, `CHANGE_EMPLOYER`, `EMPLOYER_NAME` (legal name), `TRADE_NAME_DBA`, `EMPLOYER_CITY`, `EMPLOYER_STATE`, `NAICS_CODE`, `SECONDARY_ENTITY` (worker placed at another company, a staffing signal), `WORKSITE_CITY`, `WORKSITE_STATE`, `WAGE_RATE_OF_PAY_FROM`, `WAGE_UNIT_OF_PAY`, `PW_WAGE_LEVEL` (I to IV, where I is entry level), `H-1B_DEPENDENT`.
- An LCA is filed before an H-1B petition, so a certified LCA is not a hire. USCIS's [H-1B Employer Data Hub](https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub) has actual petition decisions by employer, FY2009 to FY2026, downloadable as CSV through its Crosstab view. It names employers by name plus the last four digits of the tax ID. It is likely the better source for "did they really sponsor". I have not downloaded it yet.
- How names are written: `EMPLOYER_NAME` is the legal name as typed by the employer or their lawyer, so expect suffixes like Inc., LLC and Corporation, varying punctuation, subsidiaries, and DBA names in a separate column. I have not opened the file, so I have not seen real rows yet (unverified). The page also says FEINs are removed as personal data, while the layout lists an `EMPLOYER_FEIN` column. I don't know which is true.
- Matching plan to test in Stage 3: normalize both sides (lowercase, drop punctuation and suffixes such as inc, llc, corp, ltd, co), compare the normalized name and the trade name, prefer rows whose worksite state matches the job, and keep a small hand-made alias file for known cases (for example, a board slug that differs from the legal name). Measure the match rate on the full company list and hand-check a sample. I need your OK to download the 252 MB file for that.

## 7. Resume matching

| Method | How it works | Explainable? | Cost |
|---|---|---|---|
| Skill overlap | Find known skills in the resume and the posting from a dictionary; score = required skills found / required skills named | Yes: "matched Python, SQL; missing Spark" | Tiny, no model |
| TF-IDF / BM25 | Word weights, cosine similarity between resume and posting | Partly: top shared words | Small |
| Embeddings | all-MiniLM-L6-v2 turns each text into 384 numbers; cosine similarity | No, only "similar overall" | Downloads a model of tens of MB (exact size unverified); slow for thousands of postings on a laptop |
| LLM | Ask a model to grade each job | Gives reasons, but uses the API key per job and can invent | Cost per job, rate limits |

How others explain scores: Jobright breaks the score into Experience Level, Skill and Industry [2]. Simplify lists matched and missing keywords [1]. Reviews say a single number without reasons misleads [3][5].

Recommendation: start with skill overlap plus hard filters (location, seniority from the title, work authorization), and show the matched and missing skills as the reason. The skill dictionary can start from O*NET Technology Skills (tab-separated, about 30,000 rows, with a "Hot Technology" flag), which is CC BY 4.0 with attribution to the O*NET database and DOL ETA [15][16], plus the skills already in the user's `Profile.skills`. Add TF-IDF only as a tie-breaker if overlap leaves too many ties. Skip embeddings and the LLM unless the hand check in Stage 5 shows overlap is not good enough.

## 8. Risks

- **Terms of use**: the three documented ATS APIs are public and keyless, but none says outright that third parties may read them in bulk. Workday is undocumented. Mitigation: read only public boards, one request at a time per host, pauses, back off on 429 and 5xx, cache results and don't refetch boards more than about once a day, one honest generic user agent (no rotation).
- **Getting blocked**: each user runs from their own home IP. A few hundred to two thousand requests a day spread across vendors is small next to what each career site gets, but I have no measured limit for any vendor (unverified). Workday is the most likely to throttle.
- **Freshness**: Greenhouse gives `updated_at`, Ashby `publishedAt`, Lever `createdAt`. Workday only gives text like "Posted Today". About 10% of slugs go dead. Postings disappear from the feed when closed, so "missing from today's fetch" means closed.
- **Wrong tags**: a wrong "no sponsorship" tag hides a good job from an international student, and a missed one wastes an application. Mitigation: always show the evidence sentence, keep "not stated" separate from "unclear", never drop a job silently, and check accuracy by hand on a sample.
- **Legal advice**: tags describe what a posting says. They are not advice about anyone's status.
- **Personal data**: the resume, profile, settings, applied history and collected jobs stay in a gitignored folder or browser storage. Tests use made-up profiles. Anything sent to an LLM follows the repo's existing rules (whole profile only when the user has saved a key).
- **Data size**: about 1.3 GB per full run with descriptions (estimated above). Store only the fields we use and the text of jobs that pass filters.

## Recommended approach

1. **Sources**: Greenhouse, Lever and Ashby first, Workday second, SmartRecruiters third. Nothing that needs a login or forbids scraping.
2. **Companies**: a one-time script, run on the user's machine, that reads the Simplify listing files and the MIT aggregator lists and writes `(company, ats, slug)` to a gitignored file, plus a small hand-kept file of extra companies. Boards that return 404 are marked and skipped next time.
3. **Two-step fetch**: get each board's list, filter on title, location and posting date, then get or keep descriptions only for jobs that pass. Cache by job id and `updated_at`.
4. **Work authorization tags**: rule-based, each with the evidence sentence and the job's country. Values: stated restriction (citizen, U.S. person, clearance, no sponsorship, no sponsorship in future), stated positive (sponsors, OPT welcome, E-Verify), "not stated", "unclear" (a phrase was found but the rules can't read it). Filters hide by tag on the user's request, and a count shows how many were hidden.
5. **Sponsorship history**: shown next to the posting tag, never merged into it: "Filed N H-1B LCAs in FY2026 (M at wage level I)". USCIS approvals can be added if the DOL match rate is poor.
6. **Matching**: skill overlap with matched and missing lists, as above.

Changes I would make to your plan:
- **"Unclear when unsure" is not enough.** Most postings say nothing at all, which is different from a confusing sentence. Use both "not stated" and "unclear".
- **The rule-based resume parser can be smaller than a parser.** Matching only needs skills, recent titles and degree. The friend's LLM parser already fills `Profile.skills`, so the rule-based step can be a skill-dictionary scan of the resume text, not a full section parser.
- **Where it runs (needs your decision).** The documented ATS APIs all send `Access-Control-Allow-Origin: *`, so a web page could call them directly, but Workday cannot be called from a page. The saved profile lives in the extension's `chrome.storage.local`. Two options:
  - A. On this branch: a Node command (`npm run collect`) plus a small local page, with the profile read from a gitignored `profile.json` in the same `Profile` shape. At the merge, an extension page could call the same functions. Simple to test and needs nothing from `packages/extension` now.
  - B. Build it as an extension page from the start. This reuses the stored profile and the LLM key directly, but needs manifest and build changes in `packages/extension`, which this branch must not touch.
  I recommend A, with the collectors and taggers as plain functions that take `fetchFn`, so the merge only adds a thin extension page.
- **H-1B history from USCIS too.** It records petitions actually decided, not just labor filings.

## Open questions for you

1. Do you approve option A (Node command plus local page on this branch)?
2. May I download the 252 MB DOL FY2026 Q3 file, and the USCIS Data Hub CSV, to measure company-name matching in Stage 3?
3. From Stage 0: follow the friend's "one comment above every function" rule, or yours? And may `packages/jobs` avoid new dependencies so the lockfile stays untouched?

## Sources

1. Jobara, "Simplify Jobs Review 2026": https://jobara.ai/blog/simplify-jobs-review
2. FavTutor, "JobRight AI Review 2026": https://favtutor.com/jobright-ai-review/
3. ResumeUp.AI, "Tsenta Review (2026)": https://resumeup.ai/blog/tsenta-review
4. JobsAICopilot, "Tsenta AI Review 2026": https://jobsaicopilot.com/tsenta-ai-review/ (via search summary, page not opened)
5. Careery, "Jobright AI Review 2026": https://careery.pro/blog/ai-job-search/jobright-ai-review and Wobo: https://www.wobo.ai/blog/jobright-review/ (via search summary)
6. DEV Community write-ups on the Workday endpoint, e.g. https://dev.to/adderleydata/the-workday-job-board-api-measured-20-a-page-a-2000-cap-and-an-offset-that-loops-24hb (via search summary; not official)
7. Greenhouse Job Board API: https://docs.greenhouse.io/job-board.html
8. Lever Postings API: https://github.com/lever/postings-api
9. Ashby public job posting API: https://developers.ashbyhq.com/docs/public-job-posting-api
10. SmartRecruiters Posting API: https://developers.smartrecruiters.com/docs/posting-api
11. USCIS, OPT for F-1 Students: https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-opt-for-f-1-students
12. USCIS, STEM OPT Extension: https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-extension-for-stem-students-stem-opt
13. ICE SEVP, Practical Training: https://www.ice.gov/sevis/practical-training
14. E-Verify, What is E-Verify: https://www.e-verify.gov/about-e-verify/what-is-e-verify
15. O*NET Technology Skills file description: https://www.onetcenter.org/dictionary/27.0/text/technology_skills.html
16. O*NET database license: https://www.onetcenter.org/license_db.html
17. DOL OFLC Performance Data: https://www.dol.gov/agencies/eta/foreign-labor/performance
18. USCIS H-1B Employer Data Hub: https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub

## Appendix: 60 postings with work-authorization phrases

Picked at random from the matches, at most 3 per company per type. Excerpts are cut from the posting text with tags removed. Postings change, so a link may no longer show the same text.

| # | Type | Company | Title | Location | Phrase (excerpt) | Hand check |
|---|---|---|---|---|---|---|
| 1 | no sponsorship | [mozilla](https://job-boards.greenhouse.io/mozilla/jobs/8302988) | Senior Manager, Accounting & Finance | Remote | "...ts outside of these markets at this time. And, we do not provide visa sponsorship. How to apply Please apply directly through our career page . We car..." | Correct |
| 2 | no sponsorship | [weloglobal](https://jobs.lever.co/weloglobal/7daae088-ee92-435c-a67d-21606f73114f) | Project Perseus / Data Quality Analyst - Ital | California | "...e Work Authorization: Must be authorized to work in the U.S. (no visa sponsorship) Pay Rate: $38/hour Important: This is a 100% onsite position - remo..." | Correct |
| 3 | no sponsorship | [weloglobal](https://jobs.lever.co/weloglobal/d1dd2634-2ff4-4c57-8da4-02922c02c237) | Project Perseus /  Data Labeling Associate -  | California | "...e Work Authorization: Must be authorized to work in the U.S. (no visa sponsorship) Pay Rate: $34/hour Important: This is a 100% onsite position - remo..." | Correct |
| 4 | no sponsorship | [beaconai](https://jobs.ashbyhq.com/beaconai/e119daa4-ebbe-4e77-b17a-4b317f9ec045) | Senior Software Engineer, Cloud Infrastructur | San Carlos  - Hybrid | "...uals granted asylum or refugee status). We are unable to provide visa sponsorship or support visa transfers. All work must be performed in the United..." | Correct |
| 5 | no sponsorship | [renaissancelearning-nam](https://job-boards.greenhouse.io/renaissancelearning-nam/jobs/5449375008) | Manager, Global Mobility & People Relations | Remote - US | "...rized to work for any employer in the United States. We are unable to sponsor or take over sponsorship of an employment Visa at this time. For more in..." | Correct |
| 6 | no sponsorship | [weloglobal](https://jobs.lever.co/weloglobal/da083979-a895-4b30-b3d6-1eabc3912c02) | Project Perseus / Data Quality Analyst - Span | California | "...e Work Authorization: Must be authorized to work in the U.S. (no visa sponsorship) Pay Rate: $38/hour Important: This is a 100% onsite position - remo..." | Correct |
| 7 | no sponsorship | [great-gray-group](https://jobs.lever.co/great-gray-group/41321d12-2390-40ff-9c39-5bf3dc77b8a5) | Technology Operations Lead | Remote, USA | "...d to work directly for any employer in the United States without visa sponsorship or transfer. Responsibilities Define and maintain the SOPs for Agile..." | Correct |
| 8 | no sponsorship | [spotify](https://jobs.lever.co/spotify/a3c9129a-2160-4f3b-a2b5-d07868074aa1) | Markets Strategy & Operations Manager, SEA | Singapore | "...valid right to work in Singapore. We are unable to provide work visa sponsorship for this position in accordance with Singapore's employment regulati..." | Wrong: Right phrase, but the job is in Singapore, so it says nothing about US work |
| 9 | no sponsorship | [scaleai](https://job-boards.greenhouse.io/scaleai/jobs/4660340005) | Machine Learning Fellow - Human Frontier Coll | United States | "...099 independent contractor engagement. Work authorization : We do not sponsor visas for Fellows. To participate in the HFC Fellows program, you need t..." | Correct |
| 10 | no sponsorship | [mozilla](https://job-boards.greenhouse.io/mozilla/jobs/8174313) | Staff Product Engineer, Enterprise AI  | Remote | "...ts outside of these markets at this time. And, we do not provide visa sponsorship. How to apply Please apply directly through our career page . We car..." | Correct |
| 11 | no sponsorship | [mozilla](https://job-boards.greenhouse.io/mozilla/jobs/8302972) | Senior Manager, Accounting & Finance | Remote US | "...ts outside of these markets at this time. And, we do not provide visa sponsorship. How to apply Please apply directly through our career page . We car..." | Correct |
| 12 | no sponsorship | [beaconai](https://jobs.ashbyhq.com/beaconai/3ee3570f-13f8-44ee-879c-b33d40b56b12) | Senior Software Engineer, Frontend/Web App | San Carlos  - Hybrid | "...uals granted asylum or refugee status). We are unable to provide visa sponsorship or support visa transfers. All work must be performed in the United..." | Correct |
| 13 | citizenship | [agile-defense](https://jobs.lever.co/agile-defense/4e7202a0-c01d-4d73-a699-09e42a05cfbf) | Cloud Engineers, Senior Engineers, Architects | Reston, VA | "...referred. We can begin processing for candidates who do not hold one. Citizenship: U.S. Citizenship required Location: Reston, VA - Hybrid 3-5 days Sa..." | Correct |
| 14 | citizenship | [agile-defense](https://jobs.lever.co/agile-defense/2a1c2b4e-0673-4118-9443-e2ccdb5f9ec1) | Enterprise Asset Manager (CBP) | Reston, VA | "...referred. We can begin processing for candidates who do not hold one. Citizenship: U.S. Citizenship required Location: Reston, VA - Hybrid 3 to 5 days..." | Correct |
| 15 | citizenship | [andurilindustries](https://boards.greenhouse.io/andurilindustries/jobs/5186859007?gh_jid=5186859007) | Fullstack Software Engineer, ArsenalOS | Costa Mesa, California, United | "...pt, React, Typescript, and web frameworks such as React or NextJS. US Citizenship is required as this position needs to access export controlled data...." | Correct |
| 16 | citizenship | [andurilindustries](https://boards.greenhouse.io/andurilindustries/jobs/5131984007?gh_jid=5131984007) | Air Vehicle Systems Verification Lead | Costa Mesa, California, United | "...atus, TPMs, and TRR packages to program leadership and customers U.S. citizenship required; ability to obtain and maintain a U.S. security clearance P..." | Correct |
| 17 | citizenship | [spacex](https://boards.greenhouse.io/spacex/jobs/8841906002?gh_jid=8841906002) | Director of Legal, Government Contracts | Washington, DC | "...idered Must be able to work extended hours and weekends, as needed US citizenship required due to government contract obligations Active TS/SCI cleara..." | Correct |
| 18 | citizenship | [spacex](https://boards.greenhouse.io/spacex/jobs/8841936002?gh_jid=8841936002) | Director of Legal, Government Contracts | Hawthorne, CA | "...idered Must be able to work extended hours and weekends, as needed US citizenship required due to government contract obligations Active TS/SCI cleara..." | Correct |
| 19 | citizenship | [sardine](https://jobs.ashbyhq.com/sardine/b03b9dc7-9655-4eda-b918-7acd3da2ffb0) | Solutions Architect, Integrations - Public Se | North America | "...ng, Python, SQL, Ruby, Golang, Postman) REQUIREMENTS - Must be a U.S. citizen and reside in the U.S. - Only candidates with the ability and willingnes..." | Correct |
| 20 | citizenship | [agile-defense](https://jobs.lever.co/agile-defense/4d37db04-1b03-4156-9ef1-215b0234bf3f) | Technical Writer (CBP) | Ashburn, VA | "...referred. We can begin processing for candidates who do not hold one. Citizenship: U.S. Citizenship required Location: Ashburn, VA Salary Range: [Pend..." | Correct |
| 21 | citizenship | [andurilindustries](https://boards.greenhouse.io/andurilindustries/jobs/5160994007?gh_jid=5160994007) | Senior Program Financial Analyst, AD&S | Costa Mesa, California, United | "...blem-solving, written, and verbal communication skills Must be a U.S. citizen and be eligible to apply for and maintain a U.S. security clearance PREF..." | Correct |
| 22 | citizenship | [beaconai](https://jobs.ashbyhq.com/beaconai/92f47192-032d-42d1-9900-076849252f11) | Senior Software Engineer, iOS/Mobile | San Carlos  - Hybrid | "...U.S. export control regulations, we can only hire U.S. Persons (U.S. citizens, Green Card holders, lawful permanent residents, or individuals granted..." | Correct |
| 23 | citizenship | [databricks](https://databricks.com/company/careers/open-positions/job?gh_jid=8739519002) | Director, Delivery Solutions Architects - Pub | Maryland; Virginia; Washington | "...ederal contract requirements and client-site access obligations, U.S. citizenship is required . Candidates must reside in Washington, D.C., Maryland,..." | Correct |
| 24 | citizenship | [databricks](https://databricks.com/company/careers/open-positions/job?gh_jid=8899463002) | Delivery Solutions Architect - Public Sector  | United States | "...ederal contract requirements and client site access obligations, U.S. citizenship is required to access classified information. Location: Remote (US-b..." | Correct |
| 25 | U.S. person / ITAR | [vardaspace](https://job-boards.greenhouse.io/vardaspace/jobs/8015199003) | Senior Environmental Test Engineer | El Segundo, California, United | "...incentives in the form of stock options and/or long-term cash awards ITAR Requirements Varda, like all employers, must ensure that its employees work..." | Correct |
| 26 | U.S. person / ITAR | [spacex](https://boards.greenhouse.io/spacex/jobs/8680649002?gh_jid=8680649002) | Sr. Manager, Payroll | Hawthorne, CA | "...s or exceeds the accrual, carryover, and use requirements of the law. ITAR REQUIREMENTS: To conform to U.S. Government export regulations, applicant m..." | Correct |
| 27 | U.S. person / ITAR | [spacex](https://boards.greenhouse.io/spacex/jobs/8534765002?gh_jid=8534765002) | Hardware Development Engineer, Power (Starlin | Redmond, WA | "...elect Seattle locations to the SpaceX Redmond office Monday to Friday ITAR REQUIREMENTS: To conform to U.S. Government export regulations, applicant m..." | Correct |
| 28 | U.S. person / ITAR | [spacex](https://boards.greenhouse.io/spacex/jobs/8626535002?gh_jid=8626535002) | Data Engineer (Starlink) | Bastrop, TX | "...ravel to customer sites, other SpaceX locations, and events as needed ITAR REQUIREMENTS: To conform to U.S. Government export regulations, applicant m..." | Correct |
| 29 | U.S. person / ITAR | [databricks](https://databricks.com/company/careers/open-positions/job?gh_jid=7319791002) | Senior Staff Software Engineer - Delta | Berlin, Germany | "...status, and other protected characteristics. Compliance If access to export-controlled technology or source code is required for performance of job d..." | Wrong: Boilerplate on a Berlin job; it leaves export control to the employer's discretion |
| 30 | U.S. person / ITAR | [andurilindustries](https://boards.greenhouse.io/andurilindustries/jobs/5124708007?gh_jid=5124708007) | Production Coordinator, Electromagnetic Warfa | Irvine, California, United Sta | "...bleau, Confluence, SQL or any reporting feature experience. Must be a U.S. Person due to required access to U.S. export controlled information or faci..." | Correct |
| 31 | U.S. person / ITAR | [databricks](https://databricks.com/company/careers/open-positions/job?gh_jid=8788176002) | Team Lead - Platform Monitoring Engineer | Bengaluru, India | "...status, and other protected characteristics. Compliance If access to export-controlled technology or source code is required for performance of job d..." | Wrong: Same boilerplate on a Bengaluru job |
| 32 | U.S. person / ITAR | [databricks](https://databricks.com/company/careers/open-positions/job?gh_jid=8842408002) | Enterprise Account Executive  | Sydney, Australia | "...status, and other protected characteristics. Compliance If access to export-controlled technology or source code is required for performance of job d..." | Wrong: Same boilerplate on a Sydney job |
| 33 | U.S. person / ITAR | [vardaspace](https://job-boards.greenhouse.io/vardaspace/jobs/8146423003) | Senior Embedded Software Engineer | El Segundo, California, United | "...incentives in the form of stock options and/or long-term cash awards. ITAR Requirements Varda, like all employers, must ensure that its employees work..." | Correct |
| 34 | U.S. person / ITAR | [andurilindustries](https://boards.greenhouse.io/andurilindustries/jobs/5205902007?gh_jid=5205902007) | Production Test Specialist, Barracuda | Santa Ana, California, United  | "...documenting findings Able to lift up to 50 lbs. unassisted Must be a U.S. Person due to required access to U.S. export controlled information or faci..." | Correct |
| 35 | U.S. person / ITAR | [andurilindustries](https://boards.greenhouse.io/andurilindustries/jobs/5271826007?gh_jid=5271826007) | 2027 Business Operations Intern | Costa Mesa, California, United | "...inue academic studies for at least one quarter or semester. Must be a U.S. Person due to required access to U.S. export-controlled information or faci..." | Correct |
| 36 | U.S. person / ITAR | [muonspace](https://job-boards.greenhouse.io/muonspace/jobs/5239398007) | Staff Software Engineer Clearance, Flight Sof | Northern VA | "...A, ID, MD, MA, MI, MN, MO, NJ, NY, NC, OH, OR, PA, TN, TX, VT, VA, WA ITAR/EAR Requirements This position requires access to export controlled informa..." | Correct |
| 37 | clearance | [andurilindustries](https://boards.greenhouse.io/andurilindustries/jobs/5167630007?gh_jid=5167630007) | Software Engineer - Maritime Integrated Syste | Quincy, Massachusetts, United  | "...pacity Eligible to obtain and maintain an active U.S. Secret security clearance Preferred Qualifications Experience in a role for the delivery of a mi..." | Correct |
| 38 | clearance | [scaleai](https://job-boards.greenhouse.io/scaleai/jobs/4717701005) | Team Lead, ARC Software Engineering Team | Washington, DC | "...ture direction of our offerings. Must have: At least an active secret clearance. This is a requirement and candidates will not be considered who do no..." | Correct |
| 39 | clearance | [databricks](https://databricks.com/company/careers/open-positions/job?gh_jid=8589172002) | Sr Technical Solutions Engineering | McLean, Virginia | "...ve Top Secret / Sensitive Compartmented Information (TS/SCI) security clearance. Nice to have: Possession of a current polygraph (Cou..." | Correct |
| 40 | clearance | [andurilindustries](https://boards.greenhouse.io/andurilindustries/jobs/5186084007?gh_jid=5186084007) | Senior Firmware Engineer, Space Embedded Syst | Costa Mesa, California, United | "...cores. Eligible to obtain and maintain an active U.S. Secret security clearance. PREFERRED QUALIFICATIONS Advanced expertise with C/C++. Experience wo..." | Correct |
| 41 | clearance | [agile-defense](https://jobs.lever.co/agile-defense/d3a2a7f6-80b2-4773-b31d-352d11790af2) | Data Engineer - St. Louis | Scott AFB, IL | "...ob Title: Data Engineer Location: O'Fallon (St. Louis), IL: Scott AFB Clearance Level:This position requires candidates to be U.S. citizens and to pos..." | Correct |
| 42 | clearance | [andurilindustries](https://boards.greenhouse.io/andurilindustries/jobs/5215557007?gh_jid=5215557007) | Senior Technical Program Manager, Release, Mi | Washington, District of Columb | "...are development environments Must be eligible to hold a US Top Secret clearance Deep technical acumen: understand software development lifecycles, sys..." | Correct |
| 43 | clearance | [agile-defense](https://jobs.lever.co/agile-defense/d3795a5a-3153-49da-8b81-721138b56a14) | Software Engineer (Mid & Senior) | Remote | "...1825 Job Title: Software Engineer II Location: Remote, United States Clearance Level: Must be able to obtain Public Trust clearance Requisition #: 18..." | Correct |
| 44 | clearance | [agile-defense](https://jobs.lever.co/agile-defense/0d56572d-2125-4e6d-9a9c-6ba44d500dbe) | Senior Software Architect (Technical Lead) | Camp Smith, HI | "...Software Architect (Technical Lead) Location: Honolulu, HI / On-site Clearance Level: TS/SCI eligibility required Required Certification(s):None..." | Correct |
| 45 | clearance | [spacex](https://boards.greenhouse.io/spacex/jobs/8880656002?gh_jid=8880656002) | Sr. AI Security Software Engineer (Starshield | Washington, DC | "...ently and in a team Active Top Secret, Top Secret SCI, or DOE Level Q clearance ADDITIONAL REQUIREMENTS: Must be willing to work extended hours and we..." | Correct |
| 46 | clearance | [vardaspace](https://job-boards.greenhouse.io/vardaspace/jobs/8168234003) | Senior Contracts Specialist | El Segundo, California, United | "...ravel up to 10% as needed Ability to obtain and maintain a Top Secret clearance This is a full-time, 100% on-site role in El Segundo, CA Bonus Points..." | Correct |
| 47 | clearance | [muonspace](https://job-boards.greenhouse.io/muonspace/jobs/5214214007) | Senior FPGA Engineer, Networking & Security | San Jose, CA | "...ments. Ability and willingness to obtain and maintain a U.S. security clearance. Active clearance is a plus. Nice-to-Have Skills Experience with a var..." | Correct |
| 48 | clearance | [spacex](https://boards.greenhouse.io/spacex/jobs/8450147002?gh_jid=8450147002) | Sr. PCB Designer | Hawthorne, CA | "...ctively with others Active Top Secret, Top Secret SCI, or DOE Level Q clearance, or the ability to obtain and maintain one ADDITIONAL REQUIREMENTS: Ab..." | Correct |
| 49 | E-Verify | [coinbase](https://www.coinbase.com/careers/positions/8175429?gh_jid=8175429) | Employee and Workplace Experience Intern | Hybrid - New York, NY | "...al laws. US Applicants: View Employee Rights , Know Your Rights , and E-Verify Notice of Participation. Accommodations: If you are an individual with..." | Correct |
| 50 | E-Verify | [coinbase](https://www.coinbase.com/careers/positions/7964398?gh_jid=7964398) | Senior Software Engineer, Developer Infrastru | Remote - USA | "...al laws. US Applicants: View Employee Rights , Know Your Rights , and E-Verify Notice of Participation. Accommodations: If you are an individual with..." | Correct |
| 51 | E-Verify | [coinbase](https://www.coinbase.com/careers/positions/8335621?gh_jid=8335621) | Social Support Specialist I | Remote - USA | "...al laws. US Applicants: View Employee Rights , Know Your Rights , and E-Verify Notice of Participation. Accommodations: If you are an individual with..." | Correct |
| 52 | E-Verify | [forbes](https://job-boards.greenhouse.io/forbes/jobs/6219633004) | Temporary Social Media Producer | Jersey City, NJ | "...al opportunity employer. Staff and Applicant Privacy Notice Notice of E-Verify Participation..." | Correct |
| 53 | E-Verify | [vardaspace](https://job-boards.greenhouse.io/vardaspace/jobs/8017449003) | Senior Structures Engineer | El Segundo, California, United | "....e., individual admitted to the U.S. as a refugee or granted asylum). E-Verify Statement Varda Space Industries, Inc. participates in the U.S. Departm..." | Correct |
| 54 | E-Verify | [vardaspace](https://job-boards.greenhouse.io/vardaspace/jobs/8010109003) | Senior Aerodynamics and Flight Mechanics Engi | El Segundo, California, United | "....e., individual admitted to the U.S. as a refugee or granted asylum). E-Verify Statement Varda Space Industries, Inc. participates in the U.S. Departm..." | Correct |
| 55 | E-Verify | [vardaspace](https://job-boards.greenhouse.io/vardaspace/jobs/8147057003) | Senior Mission Software Engineer | El Segundo, California, United | "....e., individual admitted to the U.S. as a refugee or granted asylum). E-Verify Statement Varda Space Industries, Inc. participates in the U.S. Departm..." | Correct |
| 56 | E-Verify | [forbes](https://job-boards.greenhouse.io/forbes/jobs/6005314004) | Associate Video Producer | Jersey City, NJ | "...al opportunity employer. Staff and Applicant Privacy Notice Notice of E-Verify Participation..." | Correct |
| 57 | E-Verify | [hudson-pacific-properties](https://jobs.ashbyhq.com/hudson-pacific-properties/cf8082a0-fff1-46b4-8a14-856a91288efe) | Property Manager | Palo Alto, CA | "...applicable screenings in accordance with local laws. The company uses E-Verify to confirm the identity and employment eligibility of all new hires. If..." | Correct |
| 58 | E-Verify | [spacex](https://boards.greenhouse.io/spacex/jobs/8901124002?gh_jid=8901124002) | HRIS Compliance Analyst | Hawthorne, CA | "...e/aerospace company, or similarly regulated employer (OFCCP, EEO, I-9/E-Verify, or audit-ready workforce data) Experience supporting EEO-1, VETS-4212,..." | Wrong: E-Verify is listed as a skill for an HR role, not as an employer statement |
| 59 | E-Verify | [hudson-pacific-properties](https://jobs.ashbyhq.com/hudson-pacific-properties/86c2edd4-0b7d-4f07-8f69-c4577b7192f5) | Recruiter | Los Angeles CA | "...applicable screenings in accordance with local laws. The company uses E-Verify to confirm the identity and employment eligibility of all new hires. If..." | Correct |
| 60 | E-Verify | [forbes](https://job-boards.greenhouse.io/forbes/jobs/6230815004) | Temporary Researcher, Top Hospitals list | United States | "...al opportunity employer. Staff and Applicant Privacy Notice Notice of E-Verify Participation..." | Correct |

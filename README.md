# Auto Applier

A Chrome extension that fills in job application forms from a profile you save once. There is no server: everything runs in your browser, and your data stays on your computer.

It started as a personal tool and is now open to contributors. It is not a hosted product: you build it and load it into Chrome yourself, with your own API key. It fills the form and stops. **It never clicks Submit**: you review the page and submit it yourself.

## What it can do

- Keeps one profile: name, contact details, links, skills, work authorization answers, and your work history and education.
- Builds that profile from your resume (PDF or text file) using an AI model.
- Fills the fields it recognises on an application page: text boxes, dropdowns, radio buttons, checkboxes and search-as-you-type boxes.
- For everything the rules cannot answer (equal-opportunity questions, "ever employed by…", opt-ins, written questions), asks the AI once, giving it your whole profile and the free-text notes you keep in the popup. It never ticks single consent checkboxes for you.
- Outlines what needs you: **red** failed, **amber** not filled (unknown field or nothing saved for it), **blue** written or chosen by the AI (please check it).

## Status (read this)

All automated tests pass, but they use fake pages and a fake network. By hand, only the sample form in `fixtures/` has been tried in Chrome. **It has not been tried on a real job site, and the resume upload, the settings panel and the real Gemini and Groq calls have not been confirmed in real Chrome yet.** Expect rough edges and report what breaks.

## What you need

- **Node.js and npm.** Developed on Node 26 and npm 11; older versions are untested.
- **Google Chrome** (or another Chromium browser that can load unpacked extensions).
- **A Gemini API key** from Google AI Studio. This is needed for resume parsing and for the AI help. Filling the fields it recognises without the AI works without a key.
- Optionally, **a Groq API key** as a backup for when Gemini is busy or down.

## Install and run

```bash
git clone https://github.com/patsypppe/auto-applier.git
cd auto-applier
npm install
npm run build
```

The build writes the extension to `packages/extension/dist`.

Load it into Chrome:

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the folder `packages/extension/dist`.
4. Pin the Auto Applier icon from the puzzle-piece menu so it is easy to reach.

**After you change any code:** run `npm run build`, then press the reload arrow on the extension's card in `chrome://extensions`. The reload matters: the popup picks up new code by itself, but the background worker keeps running the old code until the extension is reloaded. Also reload any job page tab that was already open.

## First-time setup

1. Click the Auto Applier icon and open **LLM settings**.
2. In the **Gemini** section, paste your key, press **Save**, then **Test connection**. You should see "Connected. Gemini answered."
3. Optional: do the same in the **Groq** section. Providers are tried in order (Gemini first). Groq is only asked if Gemini fails.
4. Build your profile in one of two ways:
   - **Upload a resume** with "Fill your profile from a resume (PDF or text)". If the profile is complete it is saved automatically. Otherwise the form is filled in and lists what is missing. Work authorization is usually missing on the first run, because a resume does not say it.
   - Or **type it in** and press **Save profile**.
5. Check the form (especially the work authorization answers) and press **Save profile** again if you changed anything.
6. Fill in City, State and Country (a resume often gives no country), and the **Other facts the AI may use** box: for example "Male. Asian (South Asian). Not a veteran. No disability. Not previously employed at the companies I apply to." The AI uses this for equal-opportunity and yes/no questions. Leave it blank if you would rather answer those yourself.

## Using it on an application

1. Open the job application page.
2. Click the icon and press **Fill this page**.
3. The popup shows how many fields were filled, left alone and need you. Fix the outlined fields yourself, check the blue ones, and press the site's own Submit button.

It never overwrites something that is already in a field. For forms with several steps, press **Fill this page** on each step. It does not click Next for you and does not log in.

### Try it without a real site

```bash
python3 -m http.server 8000 -d fixtures
```

Then open `http://localhost:8000/simple-application.html`, save a profile in the popup and press **Fill this page**.

## What leaves your browser

- Your profile and API keys are stored in the browser (`chrome.storage.local`, plain text). The keys are used only by the extension's background worker, never by the web page.
- Rules fill everything they can without sending anything. The AI is called only when something is left undecided.
- **What is sent when it is called: your whole profile** (name, email, phone, links, jobs and their descriptions, education, skills, work-authorization and salary answers, and your notes), the labels and options of the unresolved fields, and for written questions up to 4,000 characters of the job page's text. It is sent in one call.
- **Resume upload sends the resume text** to the AI.
- Prompts go to Google (Gemini), and to Groq only if you added a Groq key and Gemini failed.
- If you use Gemini's free tier, check Google's terms on how free-tier content is used.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Installs dependencies for all packages. |
| `npm run build` | Builds the extension into `packages/extension/dist`. |
| `npm test` | Runs all tests (core first, then the extension). |
| `npm run typecheck` | Type-checks core and the extension. |

The job feed has its own commands; see below.

## How the project is laid out

```
packages/core/        The logic, with no browser code: profile, field discovery,
                      matching, filling, the AI steps, resume parsing, LLM clients.
packages/extension/   The thin Chrome layer: popup, content script, background
                      worker, storage, and the build.
packages/jobs/        The job feed: collects postings from public job boards and ranks
                      them against your profile (see "Job feed" below).
fixtures/             A sample application form for tests and trying it by hand.
CLAUDE.md             Design notes and working rules for the project.
plan.md               The roadmap.
```

`CLAUDE.md` describes the design in detail (how fields are matched, what the AI is allowed to see, what is not built yet).

## Job feed

`packages/jobs` is a separate command-line tool and local web page. It collects postings from companies' public Greenhouse, Lever and Ashby boards, tags what each says about work authorization, ranks jobs against your profile, and tracks the ones you apply to. Everything stays on your computer. See [packages/jobs/README.md](packages/jobs/README.md) for the commands and their limits.

## Known limits

- Not tried on real job sites yet.
- Does not click Next or Submit and does not log in.
- Resume file upload into file inputs is built but has not been tried in real Chrome.
- Fields hidden off-screen (not with `display: none`) are not skipped, so some honeypot fields could be filled.
- Every field it cannot fill is outlined amber, which can be noisy.
- English labels only. Custom dropdowns built from plain `div`s and shadow DOM are not handled.
- Chinese, Japanese and Korean PDFs read poorly, scanned (image-only) PDFs have no text, and Word documents are not supported.
- Experience and education can be filled from a resume but cannot be edited by hand in the popup yet.

## Troubleshooting

| You see | What to do |
|---|---|
| "Could not establish connection. Receiving end does not exist." | The background worker is not running or is out of date. Reload the extension in `chrome://extensions`, then try again. If it persists, open the card's **Errors** button or its "service worker" link and look for an error. |
| "No LLM is set up" or "No Groq API key is saved" | Save a key in the matching section of **LLM settings**. |
| "Gemini returned 503… high demand" | Google is overloaded. Wait a minute and retry, or add a Groq key as a backup. |
| "Gemini returned 429" | You hit a rate limit. Wait a moment and retry. |
| "Could not reach this page. Reload the tab and try again." | Reload the job page tab (and the extension if you just rebuilt it). |
| "AI help skipped: …" under the fill result | The rules still filled what they could. The note says why the AI step was skipped, usually a missing key or a busy provider. |
| The popup closes when you pick a resume file | Tell the author. A popup that closes stops the upload, and the fix is to move the panels to a full page. |

## Contributing

Contributions are welcome, with strict rules because this tool types personal data into real applications. Read [CONTRIBUTING.md](CONTRIBUTING.md) first. In short: pick an open issue, ask to be assigned, write the test first, keep the pull request to one issue, and never commit personal data. Look for the `good first issue` and `help wanted` labels. Security problems go through [SECURITY.md](SECURITY.md), not a public issue. Conduct rules are in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

No licence has been chosen yet (tracked in an open issue). Until one is added, all rights are reserved by the author.

## For a friend using their own copy

Clone, install, build and load it as above. Use your own API keys and your own profile. Nothing personal is stored in the repository, and keys never go in the code.

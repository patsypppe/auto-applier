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

## Giving it a link

Paste a job link into **Application link** in the popup and press **Open and apply**. The extension opens the link in a new tab, finds the button that opens the application (an Apply button, a known address for Lever and Ashby, and failing that it asks the AI which button to press), fills each page, presses Next, and **stops at the last page for you to review and submit**. If your profile has no answer for a required question, the AI first tries to work it out from your profile, and if it cannot, it makes a best guess. Every guess is outlined and listed in the result so you can check it. It never guesses names, contact details, consent boxes or equal-opportunity answers. It does not log in or solve CAPTCHAs; it stops and tells you.

## Using it on an application

1. Open the job application page.
2. Click the icon and press **Fill this page**, or **Fill and continue** for a form with several steps.
3. The popup shows how many fields were filled, left alone and need you. Fix the outlined fields yourself, check the blue ones, and press the site's own Submit button.

It never overwrites something that is already in a field. It does not log in.

**Fill and continue** fills a step, presses a button that says Next or Continue, waits for the page to change, and fills the next step. It never presses Submit, Apply, Send, Finish or Confirm: if any button on the page could submit, it stops and tells you. It also stops when a required field is left, when it finds a CAPTCHA or a password field, when a Next press changes nothing, when the page moves to another website, after 15 steps, or when you press **Stop**. It carries on across page reloads only within about 20 seconds of pressing Next. A site may save your progress or create a draft when Next is pressed.

### Try it without a real site

```bash
python3 -m http.server 8000 -d fixtures
```

Then open `http://localhost:8000/simple-application.html`, save a profile in the popup and press **Fill this page**.

To try the link feature, paste `http://localhost:8000/job-description.html` into Application link. It has an Apply button that leads to the two-step form.

For Fill and continue, open `http://localhost:8000/multi-step-application.html` instead. It has two steps, a question that appears after an answer, and a Submit button that the extension must never press (the page title changes to "SUBMITTED" if it does).

## What leaves your browser

- Your profile and API keys are stored in the browser (`chrome.storage.local`, plain text). The keys are used only by the extension's background worker, never by the web page.
- Rules fill everything they can without sending anything. The AI is called only when something is left undecided.
- **What is sent when it is called: your whole profile** (name, email, phone, links, jobs and their descriptions, education, skills, work-authorization and salary answers, and your notes), the labels and options of the unresolved fields with what the page says around each (section heading, help text, placeholder, length limit, error message), the page's title, host name and form step, and for written questions up to 4,000 characters of the job page's text. Fields that appear after you answer a question are sent in a further call, and a field the page rejects gets one more call that includes the page's error message.
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
- Never presses Submit and does not log in. Fill and continue works from the page's button text (English only) and has only been tested on test pages, not on real job sites.
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

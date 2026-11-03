# Auto Applier

A Chrome extension (Manifest V3) that autofills job applications from a saved profile. Built for the user and one friend (5 users at most), not for the public. There is no backend: everything runs in the browser and data stays local. It is also an LLD design practice project, so how it is built matters as much as what it does.

## How we work (read this first)

- **The user proposes the design; Claude assists.** Do not redesign things or offer a competing architecture. Answer questions, point out problems, and build what was agreed.
- **One step at a time.** After each step: show the diff in the chat message itself (the user cannot see tool output), list the choices made, then wait for approval. Commit only when the user says "commit", then start the next step.
- **Tests first (TDD).** Write the test, run it and see it fail for the right reason, then implement, then run tests, `npm run typecheck` and `npm run build`.
- **Be honest about what is not verified.** The popup and content script were checked by hand in Chrome on `fixtures/simple-application.html` only (saving a profile, filling, outlining the fields that need the user). They have not been tried on a real job site. Say so rather than implying more was tested.
- **Do not guess.** If this file does not answer a design question, ask. Do not invent files, keys or behavior.
- Ask at most one or two blocking questions. Pick sensible defaults, state them, and let the user correct them.

## Code style

- Readable code. One comment line above every function saying what it does, and one comment line at the top of every file saying what the file does. No other comments unless truly needed. (JSON files cannot have comments.)
- TypeScript, strict. String-literal unions instead of enums. Types for data, interfaces for behavior.
- Immutable: build new objects, do not mutate. Small files, one clear job each.
- No `console.log`. Never use `innerHTML` with dynamic data (use `textContent`).
- Zod only at the edges (validate untrusted data). `types.ts` stays the source of truth for the `Profile` shape.
- Commit messages: `<type>: <description>` (feat, fix, refactor, docs, test, chore). No Co-Authored-By trailer (the user disabled attribution).

## Repo and commands

- This folder has its **own git repo** (branch `main`). The user's home folder is a separate repo, so never commit from there.
- npm workspaces. Tools: TypeScript, **esbuild** (bundler, chosen over Vite because content scripts must be single files), Vitest 5 (needs `vite` installed), jsdom (DOM tests), `@types/node` (for tests that read files), Zod 4 via `zod/mini`.
- `npm test` runs the core tests and then the extension tests (those stub the `chrome` global with `vi.stubGlobal`). `npm run typecheck` checks both packages. `npm run build` writes `packages/extension/dist`.
- Load in Chrome: `chrome://extensions` → Developer mode → Load unpacked → `packages/extension/dist`. After changes: build, then reload the extension.
- DOM tests need `// @vitest-environment jsdom` on the second line of the test file (after the header comment).
- Do not `cd` into `node_modules` and leave the shell there.
- TypeScript 7 loads no `@types/*` unless the tsconfig lists them: core's tsconfig has `types: ["node"]`, the extension's has `["chrome", "node"]`.
- **Bundle size matters.** The content script is injected into every frame of every page. Import Zod only as `import * as z from "zod/mini"` plus `import en from "zod/v4/locales/en.js"` (the `.js` is required). A plain `import { z } from "zod"` pulls in every language and made `content.js` 820 KB; it is now about 70 KB. Check `ls -l packages/extension/dist` after adding any dependency.
- jsdom replaces the global `URL`, so tests read files with `join(import.meta.dirname, ...)`, not `new URL(..., import.meta.url)`.
- **pdf.js (`pdfjs-dist` 6.x):** import it only from popup code (about 435 KB minified; its worker `pdf.worker.min.mjs` is a separate 1.27 MB file loaded only when a PDF is read). Cleanup is `loadingTask.destroy()`; the document object has no `destroy`. PDFs that use standard fonts without embedding them need `standardFontDataUrl` pointing at the package's `standard_fonts/` folder (816 KB). The CJK `cmaps/` folder (1.6 MB) is not shipped, so Chinese, Japanese and Korean resumes will read poorly. `createPdfTextReader` takes the library as an argument and is tested against the legacy build in Node; it is cast to a structural `PdfLibrary` type, so check the real types in `node_modules/pdfjs-dist/types` when changing it.
- To try the extension by hand: `python3 -m http.server 8000 -d fixtures`, open `http://localhost:8000/simple-application.html`, save a profile in the popup, press "Fill this page".
- The Claude-in-Chrome tool cannot open `chrome-extension://` pages, so the popup, settings and resume upload can only be checked in a real browser by the user. The ID of the unpacked `dist` folder comes from its path (currently `gpgnddaahdhncomocgljcnfdfnoaoclf`).

## Architecture

Two packages. **`packages/core` never imports `chrome.*`** (so a future headless runner can reuse it). **`packages/extension`** is a thin shell and the only place `chrome.*` appears. The core defines interfaces ("ports"); the extension implements them.

```
packages/core/src/
  profile/    types, schema (Zod), formValues, keys, keyDescriptions, names, resolveValue
  fields/     types, discoverFields, labels, radioGroup
  matching/   types, constants, matchField, normalizeText, AttributeMatcher, BareNameMatcher
  filling/    types (Filler, FillResult, FailureCode), events, findChoice, setNativeValue, waitUntil,
              TextFiller, SelectFiller, RadioFiller, CheckboxFiller, ComboboxFiller
  fill/       fillPage (the rules-only orchestrator, exports fillWith), summary (counts, needsAttention, needsReview, formatSummary)
  assist/     fillPageWithAssistant, isFreeTextQuestion, mapFieldsPrompt, pickOptionsPrompt, answerQuestionsPrompt, formatError
  adapters/   types only (SiteAdapter interface)
  ports/      ProfileStore, LLMClient, SettingsStore, ResumeStore
  llm/        settings (LLMSettings, DEFAULT_MODEL, isLLMSettings, mergeSettings), GeminiLLMClient
  resume/     types (ProfileDraft), resumePrompt, parseResume, applyDraft, importResume (ready to save vs needs review), describeHistory
  testing/    makeField, fieldFromHtml (test helpers, need a DOM)
packages/extension/
  public/manifest.json    MV3, permission: storage, host permission for generativelanguage.googleapis.com, content script on <all_urls> with all_frames
  src/background.ts       answers `llm-complete` messages from this extension (only the background worker uses the API key)
  src/llm/                answerLlmRequest (saved settings → client → reply), BackgroundLLMClient (proxy that popup and content code use)
  src/content.ts          on a "fill-page" message: runs runFill with the profile store and BackgroundLLMClient, and sends the reply to the popup
  src/fill/runFill.ts     one fill of the page: checks the saved profile, fillPageWithAssistant, outlines fields, builds the reply (summary and notes)
  src/page/               collectJobContext (title, description and main text of the job page, without forms and menus)
  src/resume/             extractResumeText (PDF or text file to text), pdfText (createPdfTextReader), browserPdfReader (pdf.js with its worker and fonts, popup only), importResumeFile (read, ask the LLM, store the file, then save the profile or return it for review)
  src/messaging.ts        message types between popup, content scripts and the background worker, with type guards
  src/ui/                 highlightFlagged (red outline for failed, amber for unmatched or no-value, blue for what the AI wrote or chose)
  src/popup/              popup.html, popup.ts, ProfileForm.ts, profileFields.ts, FillPanel.ts, SettingsPanel.ts (API key, model, Test connection), ResumePanel.ts (resume upload, status, what was found). `mountProfileForm` returns a handle (`getValues`, `getCarried`, `showProfile`, `showDraft`) that other panels use to read and fill the form
  src/storage/            ChromeStorageProfileStore, ChromeStorageSettingsStore, IndexedDbResumeStore (implement the core's stores)
  build.mjs               esbuild: background, content, popup entries as single iife files
fixtures/simple-application.html   test form used by fillPage.test.ts and for trying the extension by hand
```

## The pipeline (target design)

`fillPage(root, profile, setup = DEFAULT_SETUP)` runs: discover → match → resolve → fill → report, one field at a time in page order (sequential, because comboboxes need focus). `DEFAULT_SETUP` is the matcher chain plus the five fillers; tests and adapters can pass their own.

1. **discoverFields(root)** returns `FormField[]` (element, kind, label, name, options, groupId). Radio groups are ONE field (first radio is `element`, `options` are each radio's label, `groupId` is the radio name).
2. **Matcher chain** `matchField(field, matchers, threshold = 0.8)`: first result with confidence >= threshold wins (inclusive), otherwise `null`.
   - `AttributeMatcher`: autocomplete attribute 0.95, label 0.85, name attribute 0.80. Specific rules come before generic ones (legal/preferred/middle before first/last). Text-only keys (names, email, phone, links) do not match select or radio fields.
   - `BareNameMatcher(fields)`: maps a bare "Name" to `fullName`, but only when no other field on the page is a first or last name. Built per page, so the chain is `[new AttributeMatcher(), new BareNameMatcher(fields)]`.
   - The confidence numbers are the assistant's picks and are easy to retune in `matching/constants.ts`.
3. **resolveValue(profile, key)** returns the text to type, or `undefined` if the profile has none (then the field is flagged, not filled). Derived keys: `fullName`, `legalName` (falls back to full name), `preferredName` (falls back to first name). Booleans become "Yes"/"No". Empty skills → `undefined`.
4. **Validating the value against the field** happens inside each filler (option matching, read-back after filling), not as a separate step. It is not Zod.
5. **Fillers** (one per field kind, behind the `Filler` interface): `canFill(field)` and `fill(field, value)` returning `filled`, `skipped{reason}` or `failed{reason}`.
   - `TextFiller` never overwrites a different existing value (skips with a reason), skips read-only or disabled fields, and reads the value back to catch silent rejection. It fires only `input` and `change` events (no focus or blur).
   - `setNativeValue` uses the prototype's native value setter, then dispatches `input` and `change`, so React-style forms notice.
6. **Report**: `FieldReport { field, profileKey?, outcome }`. The outcome is a `FillResult` (`filled`, `skipped`, `failed`), or `unmatched` (no matcher result), or `no-value` (key matched, profile has nothing). `needsAttention` means failed, unmatched or no-value; those fields are outlined on the page (red for failed, amber for the rest), and fields the AI wrote or chose (`needsReview`) are outlined blue. The popup button sends `fill-page` to every frame of the tab; each frame validates the saved profile (`validateProfile`), runs `runFill` on its own document (`extension/src/fill/runFill.ts`: `fillPageWithAssistant` through `BackgroundLLMClient`, with the page's title, description and main text as `jobContext`) and sends a `fill-result` (summary plus notes) back; the popup adds the frames up and shows `Filled N · Left alone N · Needs you N` (plus `· Check the AI's work on N`) and the AI notes, each once.
7. **Stop before submit.** The user has not answered whether it should auto-submit. Default: it stops and the user reviews and submits. Do not build auto-submit without asking.

## Profile model

`Profile` = `personal` (names, email, phone, links), `experience[]`, `education[]`, `skills[]`, `answers`, `resume?`.
- `personal` has optional `middleName`, `legalName`, `preferredName`; `links` has optional `linkedin`, `github`, `portfolio`.
- `answers` = `workAuthorization` (status text such as "Citizen"), `isAuthorizedToWork` (boolean, for the yes/no "authorized to work?" question), `needsSponsorship` (boolean), optional `noticePeriod`, `salaryExpectation`. Do not merge `workAuthorization` and `isAuthorizedToWork`: they answer different questions.
- `PROFILE_KEYS` in `profile/keys.ts` is the single list of matchable keys. `resolveValue` uses a `Record<ProfileKey, ...>`, so adding a key forces adding its resolver.
- `validateProfile(input: unknown)` returns `{ ok: true, profile } | { ok: false, errors: ["personal.email: ..."] }`. It takes an already-parsed object (not JSON text) and strips unknown keys. Dates are plain non-empty strings and links are not URL-checked on purpose.
- The popup form (`ProfileForm`) covers personal info, links, skills, answers. `fromFormValues(values, existing)` keeps `experience`, `education` and `resume` from the existing profile. Experience/education have no editor yet.
- The resume file itself is binary and goes in IndexedDB; `Profile.resume` only holds a pointer (`storageKey`).

## LLM design (not built yet)

- The LLM sits behind `LLMClient.completeJson(prompt): Promise<unknown>`; one implementation per provider. **Provider: Google Gemini (chosen by the user).** `GeminiLLMClient` (`core/src/llm`) calls `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with the key in the `x-goog-api-key` header (never in the URL) and `generationConfig.responseMimeType: "application/json"`; the answer text is `candidates[0].content.parts[].text`. Google's newer Interactions API (`/v1beta/interactions`, needs an `Api-Revision` header) exists and its quickstart now leads with it. `generateContent` was chosen because its response format is documented in the API reference and the endpoint is live (a keyless request returns 403, not 404). If it is ever retired, write a second client behind `LLMClient`. The default model is `gemini-3.1-flash-lite`, chosen by the user as a cheap stable model (Google's models page lists it as stable, and `gemini-3.5-flash-lite` as the other stable lite option). The name came from that page and has NOT yet been confirmed with a real call; it is a user setting in the popup. The user supplies their own API key. It is stored in plain text in `chrome.storage.local` under `llm-settings`; only the popup (to save it) and the background worker (to use it) read it, never the content script. Popup and content code reach the LLM through `BackgroundLLMClient`, which messages the worker; the worker ignores messages from other senders.
- All LLM calls run in the background service worker, never in the content script (keeps the key away from page scripts). Content script and popup talk to it through typed messages.
- **Resume parsing:** extract text with plain code (pdf.js), then the LLM turns the text into JSON, then `parseResume` (`core/src/resume`) checks the answer with a lenient Zod schema and cleans it into a `ProfileDraft` plus `warnings`. Defaults chosen by the assistant (not yet confirmed by the user): never invent, so unknown stays blank; a job or degree missing required details is dropped with a warning, and a missing start date falls back to the end date; "Present" end dates are left out; skills are de-duplicated; text over 50,000 characters is cut with a warning. The prompt marks the resume text as untrusted. `applyDraftToFormValues` fills the form fields the draft has values for and never touches the answers. **After parsing, the profile is saved automatically when it is valid (the user's decision).** `buildProfileFromDraft(draft, currentFormValues, existingProfile)` applies the draft to the form values, takes the draft's jobs and degrees over the saved ones (keeping the saved ones when the draft has none), keeps the saved resume pointer and answers, and returns a `ValidationResult`. If valid, the popup saves it and refreshes the form. If not (usually a first run, because work authorization is a required answer a resume cannot supply), the popup fills the form with the draft and lists the errors for the user to fix and Save. The user can edit and Save again at any time, and a later upload updates the same profile. Experience and education have no editor yet (step 2b), so step 9b shows them read-only. Scanned image PDFs have no text and will not work. Only PDF (and plain text) are planned first; DOCX is undecided.
- **Ambiguity goes to the LLM (decided by the user)** and is built as `fillPageWithAssistant(root, profile, llm, { setup?, jobContext? })` in `core/src/assist` (step 10a). It runs `fillPage` first (rules only), then three batched steps in this order, each skipped when it has nothing to do:
  - **Call A (map fields):** fields with outcome `unmatched` that some filler can fill, that have a label or name, and that the user has not already filled. Sends each field's label, kind, name and options (first 30, each cut to 80 characters) plus the profile key names with plain descriptions (`PROFILE_KEY_HELP`), NEVER any value. The model answers a key or `none` per field; unknown keys and `none` are dropped. Fields it maps are resolved and filled and marked `source: "ai"`.
  - **Call C (pick an option):** select or radio fields whose fill failed with `code: "no-option-match"` (the `FailureCode` added to `FillResult`). Sends the question, the options (first 60, each cut to 100 characters) and that ONE profile value, for example "No". The model must copy an option exactly or say `none`; anything not offered is dropped. The chosen option is then filled and marked `source: "ai"`.
  - **Call B (draft answers):** unmatched text fields that `isFreeTextQuestion` accepts (a textarea, or a label that ends with "?" or has six or more words) and the user has not filled. Sends the questions, the profile's skills, jobs and degrees ONLY (`profileSliceFor`; never name, contact details, links, answers or salary) and the job page text (cut to 4,000 characters, "(none)" when empty). The prompt says never to invent facts and to answer `""` when the facts do not support an answer. Answers are filled and reported as `drafted` with `source: "ai"`.
  - **A failure at any step stops the later steps** and adds the note `AI help skipped: <reason>`; what the rules and earlier steps filled is kept. All three prompts say the form and job page text are untrusted, and every answer is validated before use (`zod/mini`, shared `FORMAT_ERROR`).
  - Outcomes and counts: `FieldOutcome` gained `drafted`; `FieldReport` gained `source?: "ai"`; `needsReview` is true for drafted answers and AI-filled fields; the summary counts `aiFilled` and `drafted` and `formatSummary` ends with "Check the AI's work on N".
  - Not done for comboboxes: their options are not known until opened, so Call C skips them.
  - **What leaves the browser on "Fill this page"** (only when the rules left something undecided): labels, names and options of unrecognised fields; one answer value per option question; and for free-text questions your skills, jobs and degrees plus up to 4,000 characters of the page's title, description and main text (`collectJobContext`, which drops forms, menus, headers, footers and scripts). Nothing is sent when the rules fill everything. Without an API key the popup shows "AI help skipped: No Gemini API key is set..." on every fill, and a page inside an iframe only sees its own frame's text.
- Never send credentials, the vault or the API key to the LLM.

## Build order and status

1. Profile schema (Zod) ✅ committed
2. Profile form in popup ✅ committed (**2b: experience and education editor, deferred**)
3. `resolveValue` ✅ committed
4. `discoverFields` ✅ committed
5. `matchField`, `AttributeMatcher`, `BareNameMatcher` ✅ committed
6. Fillers: **6a** `setNativeValue` + `TextFiller` ✅ committed; **6b** `SelectFiller`, `RadioFiller`, `CheckboxFiller` ✅ committed; **6c** `ComboboxFiller` ✅ committed (`FileFiller` is proposed to move to step 9, because it needs the resume store; not yet agreed)
7. `fillPage` orchestrator + `content.ts` + "Fill this page" popup button → first end-to-end result ✅ committed (tested in jsdom and by hand in Chrome on the fixture form; not yet tried on a real job site)
8. LLM client and settings: **8a** `GeminiLLMClient` + settings types and `SettingsStore` port ✅ committed; **8b** background handler, API-key panel with a "Test connection" button in the popup, `BackgroundLLMClient` proxy, manifest `host_permissions` ✅ committed (tests pass with a fake network and fake chrome; not yet confirmed against the real Gemini API)
9. Resume parsing: **9a** `parseResume` (prompt, validated and cleaned draft with warnings) `applyDraftToFormValues` and `buildProfileFromDraft` ✅ committed; **9b** in two parts: **9b-i** the engine (`importResume`, `carryOverFromDraft`, the `CarriedOver` type, `ResumeStore` + `IndexedDbResumeStore`, `extractResumeText`, `createPdfTextReader`; ✅ committed) and **9b-ii** the popup (upload control, auto-save when valid or else fill the form and list what is missing, read-only experience/education review, browser pdf.js wiring, copy `pdf.worker.min.mjs` and `standard_fonts/` into dist; ✅ committed; tested in jsdom and Node, not yet run in real Chrome). Risk to check in 9b-ii: Chrome may close a popup when the file picker opens, and a closed popup stops the parse; components are written as `mountX(container, ...)` so they can move to an options page.
10. LLM fallback (Calls A, B and C): **10a** core engine (prompts, answer parsers, `fillPageWithAssistant`, a failure `code` on fills, AI outcomes) ✅ committed (tested with a fake model only, never with real Gemini); **10b** extension wiring (content script uses it, job page context, highlight and summary) ✅ committed (not yet run in real Chrome or against real Gemini)
11. Site adapters (`SiteAdapter` interface exists): Greenhouse first, then others, plus a generic fallback
12. Later: multi-step flow runner (Workday), credential vault and login handling

## Known gaps and open decisions

- Auto-submit vs stop-before-submit not confirmed (default: stop).
- Labels are matched with English patterns only.
- A radio group whose first radio is disabled is not discovered at all (`discoverFields` describes a group from its first radio). Not fixed; fix it if it shows up on a real site.
- A select with no placeholder: an untouched first option is treated as empty and gets overwritten; an option the page marked `selected` is respected.
- Controls hidden with CSS are not skipped, so hidden "honeypot" fields would be filled. jsdom has no layout, so this needs a real-browser check; likely the first fix after trying a real page.
- Every unmatched field is outlined amber, including search boxes and cookie checkboxes; this may be noisy on real pages.
- `FileFiller` does not exist yet, so file inputs are always reported as unmatched.
- Not handled yet: shadow DOM, custom dropdowns that are not `input[role=combobox]`, checkbox groups (each checkbox is its own field), password fields (skipped; they return with the login feature).
- Keys like `currentCompany` / `currentTitle` are deferred until the experience editor exists.
- A profile saved before `isAuthorizedToWork` existed will show "No" for it in the form. The user was told to re-check it and save.
- Making a form field fail on a real site is expected; the `FillResult` must say so instead of failing silently.

## Handling sites that resist an extension

Content scripts cannot be blocked by a site's CSP. What actually breaks, and the plan:
- Forms in iframes: `all_frames: true` plus host permissions (already in the manifest).
- Shadow DOM: `chrome.dom.openOrClosedShadowRoot`.
- Frameworks ignoring `el.value = x`: `setNativeValue` (done).
- Custom dropdowns: `ComboboxFiller` (click, type, pick the option).
- File upload: build a `DataTransfer` and assign `input.files`.
- Sites checking `event.isTrusted` (rare): last resort `chrome.debugger`, which shows a banner.
- `chrome://` pages and the Web Store cannot run extensions at all (not a problem for job sites).

## Future (do not build early, keep the seams open)

Open for extension, closed for modification: new behavior is a new class behind an existing interface. Planned later, each as a plug-in:
- New sites → new `SiteAdapter`. New matching rules → a new `Matcher` in the chain. New input kinds → a new `Filler`.
- Job scraping or RAG → a `JobSource` interface. Tailored resumes → a `ResumeProvider` (today: the one uploaded file). Email verification codes → a `VerificationCodeProvider` (today: the user types the code).
- Autonomous applying runs headless and reuses `packages/core`. It keeps a human approval step for submit at first.
- A backend would swap the `ProfileStore` and `LLMClient` implementations. Only build the interfaces a step actually uses (YAGNI).
- The user's friend runs their own copy: clone, build, load unpacked, use their own API key and profile. Secrets and personal data never go in the repo.

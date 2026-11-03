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
- `npm test` runs the core tests. `npm run typecheck` checks both packages. `npm run build` writes `packages/extension/dist`.
- Load in Chrome: `chrome://extensions` → Developer mode → Load unpacked → `packages/extension/dist`. After changes: build, then reload the extension.
- DOM tests need `// @vitest-environment jsdom` on the second line of the test file (after the header comment).
- Do not `cd` into `node_modules` and leave the shell there.
- TypeScript 7 loads no `@types/*` unless the tsconfig lists them: core's tsconfig has `types: ["node"]`, the extension's has `["chrome"]`.
- **Bundle size matters.** The content script is injected into every frame of every page. Import Zod only as `import * as z from "zod/mini"` plus `import en from "zod/v4/locales/en.js"` (the `.js` is required). A plain `import { z } from "zod"` pulls in every language and made `content.js` 820 KB; it is now about 70 KB. Check `ls -l packages/extension/dist` after adding any dependency.
- jsdom replaces the global `URL`, so tests read files with `join(import.meta.dirname, ...)`, not `new URL(..., import.meta.url)`.
- To try the extension by hand: `python3 -m http.server 8000 -d fixtures`, open `http://localhost:8000/simple-application.html`, save a profile in the popup, press "Fill this page".

## Architecture

Two packages. **`packages/core` never imports `chrome.*`** (so a future headless runner can reuse it). **`packages/extension`** is a thin shell and the only place `chrome.*` appears. The core defines interfaces ("ports"); the extension implements them.

```
packages/core/src/
  profile/    types, schema (Zod), formValues, keys, names, resolveValue
  fields/     types, discoverFields, labels, radioGroup
  matching/   types, constants, matchField, normalizeText, AttributeMatcher, BareNameMatcher
  filling/    types (Filler, FillResult), events, findChoice, setNativeValue, waitUntil,
              TextFiller, SelectFiller, RadioFiller, CheckboxFiller, ComboboxFiller
  fill/       fillPage (the orchestrator), summary (counts, needsAttention, formatSummary)
  adapters/   types only (SiteAdapter interface)
  ports/      ProfileStore, LLMClient
  testing/    makeField, fieldFromHtml (test helpers, need a DOM)
packages/extension/
  public/manifest.json    MV3, permission: storage, content script on <all_urls> with all_frames
  src/background.ts       empty, will own LLM calls
  src/content.ts          on a "fill-page" message: loads and validates the saved profile, runs fillPage, outlines flagged fields, replies with a summary
  src/messaging.ts        message types between popup and content scripts, with type guards
  src/ui/                 highlightFlagged (red outline for failed, amber for unmatched or no-value)
  src/popup/              popup.html, popup.ts, ProfileForm.ts, profileFields.ts, FillPanel.ts
  src/storage/            ChromeStorageProfileStore (implements ProfileStore)
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
6. **Report**: `FieldReport { field, profileKey?, outcome }`. The outcome is a `FillResult` (`filled`, `skipped`, `failed`), or `unmatched` (no matcher result), or `no-value` (key matched, profile has nothing). `needsAttention` means failed, unmatched or no-value; those fields are outlined on the page (red for failed, amber for the rest). The popup button sends `fill-page` to every frame of the tab; each frame validates the saved profile (`validateProfile`), runs `fillPage` on its own document and sends a `fill-result` back; the popup adds the frames up and shows `Filled N · Left alone N · Needs you N`.
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

- The LLM sits behind `LLMClient.completeJson(prompt): Promise<unknown>`; one implementation per provider. **The provider is undecided: ask the user.** The user supplies their own API key, stored locally.
- All LLM calls run in the background service worker, never in the content script (keeps the key away from page scripts). Content script and popup talk to it through typed messages.
- **Resume parsing:** extract text with plain code (pdf.js), then the LLM turns the text into JSON, then `validateProfile`, then it becomes an editable draft the user reviews before saving. Scanned image PDFs have no text and will not work.
- **Call A (map fields):** only for fields the chain could not match. Sends field metadata (label, type, options, sibling labels, section heading) and the list of key names, NEVER the user's values. Returns a key or `none` per field. One batched call per page. A `none` or low confidence leaves the field empty and flagged.
- **Call B (free-text answers):** only for long free-text questions. Sends the question, the relevant slice of the profile (experience, skills, summary) and the job description. Returns a drafted answer for the user to review.
- **Ambiguity goes to the LLM (decided by the user).** Whenever the deterministic steps cannot resolve a field, the LLM gets it: (a) no matcher result at or above the threshold (Call A); (b) the key is known but no single option matches the value in a select or radio group, for example "No" versus "I do not require sponsorship" (**Call C, proposed**: send the field's label, its options and only that one value; the LLM returns which option fits, or `none`). The fillers already report this case as `failed` with the reason `No single option matches "..."`. Step 10 must add a machine-readable code to `FillResult` so ambiguity can be routed without matching on reason text (not built yet).
- Never send credentials, the vault or the API key to the LLM.

## Build order and status

1. Profile schema (Zod) ✅ committed
2. Profile form in popup ✅ committed (**2b: experience and education editor, deferred**)
3. `resolveValue` ✅ committed
4. `discoverFields` ✅ committed
5. `matchField`, `AttributeMatcher`, `BareNameMatcher` ✅ committed
6. Fillers: **6a** `setNativeValue` + `TextFiller` ✅ committed; **6b** `SelectFiller`, `RadioFiller`, `CheckboxFiller` ✅ committed; **6c** `ComboboxFiller` ✅ committed (`FileFiller` is proposed to move to step 9, because it needs the resume store; not yet agreed)
7. `fillPage` orchestrator + `content.ts` + "Fill this page" popup button → first end-to-end result ✅ committed (tested in jsdom and by hand in Chrome on the fixture form; not yet tried on a real job site)
8. LLM client, settings (API key), manifest `host_permissions`
9. Resume parsing: `extractText`, `ResumeParser`, `ResumeUpload`, IndexedDB resume store
10. LLM fallback (Calls A and B)
11. Site adapters (`SiteAdapter` interface exists): Greenhouse first, then others, plus a generic fallback
12. Later: multi-step flow runner (Workday), credential vault and login handling

## Known gaps and open decisions

- LLM provider not chosen. Auto-submit vs stop-before-submit not confirmed (default: stop).
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

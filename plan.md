# Auto Applier: Project Plan

This is the roadmap. `CLAUDE.md` holds the working rules and the facts about the code as it stands. This file holds the full plan: what we are building, why, how, in what order, and what is still undecided. Items marked **(proposed)** are suggestions that have not been agreed yet.

## 1. Goal

Open any job link and have the extension fill the application from a saved profile, including logging in or creating an account where the site asks for one. Later, the same core powers an autonomous mode that finds jobs, tailors a resume and applies on its own.

**Why:** filling the same fields on hundreds of different sites is slow and repetitive, and every site labels and builds its fields differently. The hard part, and the design practice, is handling that variety cleanly.

### Non-goals (for now)
- A public product, accounts, billing or multi-user hosting. Five users at most.
- A backend or server. Everything runs in Chrome and stays on the user's machine.
- Job scraping, RAG, tailored resumes and autonomous applying. They come later, as plug-ins.
- Languages other than English.

### Anti-goals (a failure even if it technically works)
- Silently typing wrong data into a form.
- Sending personal data or credentials to an LLM or any third party without the user choosing to.
- Overwriting what the user already typed.
- Submitting an application without the user having a chance to review it (default: stop before submit).
- Code that has to be rewritten to add the next feature (open for extension, closed for modification).

## 2. Users and constraints

- Two people to start: the owner and a friend. Each runs their own copy: clone the repo, build, load unpacked in Chrome, enter their own LLM API key, build their own profile. Nothing is shared except code.
- Chrome, Manifest V3. Loaded unpacked, never published to the Web Store.
- Language: TypeScript. Tools: npm workspaces, esbuild, Vitest, jsdom, Zod.
- Secrets and personal data (API key, profile, resume, credentials) never go into the repo.

## 3. How it works end to end

### Phase 1: one-time setup (in the popup)
```
upload resume → extract text (plain code) → background worker → LLM → JSON
   → parseResume checks and cleans it into a draft → buildProfileFromDraft validates it
   → valid: saved automatically and the form refreshes
   → not valid (usually a first run, which needs work authorization): form filled, errors listed, user fixes and saves
   → profile in chrome.storage.local, resume file in IndexedDB
```
The user can also type or edit the profile by hand at any time, and a later resume upload updates the same profile. The saved profile, as last edited, is the source of truth.

### Phase 2: every job page (content script)
```
discoverFields → matcher chain → resolveValue → validate against field
   → filler per field kind → report
        └─ unmatched fields → background worker → LLM fallback (Call A / Call B)
```
- Each field gets a result: filled, skipped (with a reason) or failed (with a reason). Fields the extension could not fill are highlighted for the user.
- It stops before submit. The user reviews and presses submit.

### Phase 3: later
Multi-step forms, login and account creation, then the autonomous mode (section 11).

## 4. Architecture

Two packages in one repo.

- **`packages/core`**: all the logic. Plain TypeScript, no `chrome.*` imports, so it runs in tests (Node plus jsdom) and could run in a headless browser later.
- **`packages/extension`**: a thin shell. Content script, background worker, popup, and the Chrome-specific implementations of the core's interfaces.

The core defines **ports** (interfaces); the extension implements them. Swapping an implementation never touches the core.

| Port (interface) | Today | Later |
|---|---|---|
| `ProfileStore` | `ChromeStorageProfileStore` | a database or file store for a server or headless runner |
| `LLMClient` | `GeminiLLMClient` | one class per provider |
| `Matcher` | `AttributeMatcher`, `BareNameMatcher` | more matchers, added to the chain |
| `Filler` | `TextFiller` | select, radio, checkbox, combobox, file fillers |
| `SiteAdapter` | interface only | Greenhouse, Lever, Workday and so on |

Patterns in use: Strategy (fillers, adapters), Chain of Responsibility (matchers), Ports and Adapters (core versus shell), Registry (adapters and fillers looked up by kind or URL).

## 5. Data model

`Profile` = `personal` + `experience[]` + `education[]` + `skills[]` + `answers` + optional `resume`.

- `personal`: first, optional middle, last name; optional `legalName` and `preferredName` overrides; email; phone; links (`linkedin`, `github`, `portfolio`, all optional).
- `answers`: `workAuthorization` (status text such as "Citizen"), `isAuthorizedToWork` (yes/no), `needsSponsorship` (yes/no), optional `noticePeriod` and `salaryExpectation`.
- Derived, never stored: `fullName`, and the fallbacks for `legalName` (full name) and `preferredName` (first name).
- `resume` is a pointer (`storageKey`); the file itself lives in IndexedDB.
- `PROFILE_KEYS` is the single list of keys a form field can be matched to.

## 6. Core components in detail

1. **Discover** (`discoverFields`): scan a page or element for `input`, `select` and `textarea`; build a `FormField` for each (element, kind, label, name, options, groupId). Labels come from `aria-labelledby`, then `<label>` elements, then `aria-label`, then `placeholder`. A radio group is one field. Hidden, button, password and disabled controls are skipped.
2. **Match** (`matchField`): run the matcher chain; the first result at or above the 0.8 threshold wins. `AttributeMatcher` scores autocomplete 0.95, label 0.85, name 0.80. `BareNameMatcher` handles a lone "Name" field using the whole page as context. No match means the field is a candidate for the LLM fallback.
3. **Resolve** (`resolveValue`): profile key to text. No value means flag the field, never type a placeholder.
4. **Validate against the field**: done inside each filler (option matching and a read-back after filling), not as a separate step. It is a small check against the field's own rules, not Zod.
5. **Fill**: pick the `Filler` by field kind. Fillers never overwrite a different existing value, skip locked fields, and read the value back to catch silent rejection.
6. **Report**: collect one result per field; highlight the ones the user must handle.

## 7. LLM integration

- Behind `LLMClient.completeJson(prompt)`, one implementation per provider. **Provider: Google Gemini (chosen by the user)**, through the `generateContent` endpoint with the key in an `x-goog-api-key` header. The model name is a setting. The user supplies their own API key, kept in local storage.
- All LLM calls run in the background worker, never in the content script, so page scripts never see the key.
- **Resume parsing:** plain code extracts the text; the LLM turns it into JSON; `validateProfile` checks it; it becomes a draft. **(Proposed)** if validation fails, the error list can be sent back to the LLM once for a fix. Scanned (image-only) PDFs have no text and will not work.
- **Call A, map fields:** for fields the chain could not match. Sends only field metadata and the list of key names, never the user's values. Returns a key or `none` per field. One batched call per page.
- **Call B, free-text answers:** for long free-text questions. Sends the question, the relevant slice of the profile and the job description. Returns a draft answer the user reviews.
- **Call C, pick an option (proposed):** when the key is known but no single option in a select or radio group matches the value (for example "No" versus "I do not require sponsorship"), the field goes to the LLM. Sends the field's label, its options and only that one value; returns the option that fits, or `none`. This is the decided rule: any ambiguity the deterministic steps cannot resolve is handed to the LLM, and `none` or no answer leaves the field flagged.
- Never sent to the LLM: credentials, the vault, the API key.

## 8. Handling sites that resist an extension

Sites cannot block a content script. What breaks, and the fix:

| Problem | Fix |
|---|---|
| Form inside an iframe | `all_frames: true` and host permissions (already in the manifest) |
| Shadow DOM | `chrome.dom.openOrClosedShadowRoot` |
| React or Angular ignore `el.value = x` | `setNativeValue` (done) |
| Custom dropdowns | `ComboboxFiller`: click, type, pick the option |
| File upload | build a `DataTransfer` and assign it to `input.files` |
| Site checks `event.isTrusted` (rare) | last resort: `chrome.debugger`, which shows a banner |
| `chrome://` pages, Web Store | cannot be done; not relevant for job sites |

## 9. Security and privacy

- Everything stays local. The only outside traffic is calls to the user's chosen LLM provider.
- API key in extension storage; used only from the background worker.
- Credentials for the login feature go in a vault encrypted in the browser before storage. **(Proposed)** a passphrase the user enters, using Web Crypto (PBKDF2 to derive a key, AES-GCM to encrypt). Never sent to the LLM.
- Submit stays a human action by default.
- Minimal permissions: `storage` now; `host_permissions` only for the LLM provider's domain when step 8 is built.
- Profile data comes from outside the code (LLM output, forms, storage), so it is validated with Zod before it is trusted.
- Repo is private; `.gitignore` covers `node_modules`, `dist` and `.env`. No real resume or profile as a test fixture.

## 10. Testing strategy

- **Unit tests first** for every step (Vitest). Core logic runs in Node; DOM code runs in jsdom.
- **Manual Chrome check** for anything touching `chrome.*` or real pages (popup form, content script). Checklist for each such step: build, reload the extension, open the popup, try a local test page, then try a real application form.
- **HTML fixtures (proposed):** save anonymised copies of real application forms (Greenhouse, Lever, Workday) as test fixtures, so adapters and matchers are tested against realistic markup and regressions are caught. A first fixture exists: `fixtures/simple-application.html`, used by `fillPage.test.ts` and for trying the extension by hand.
- **End-to-end (proposed, later):** Playwright against fixtures or a local test form, loading the built extension.
- Known limit: jsdom has no layout, so CSS-hidden fields and real focus and blur behavior need a real-browser check.

## 11. Roadmap

Steps are built one at a time: tests first, diff shown, approval, commit. `CLAUDE.md` tracks live status.

| # | Step | Main files | Status |
|---|---|---|---|
| 1 | Profile schema | `profile/schema.ts` | done |
| 2 | Profile form in popup | `formValues.ts`, `ProfileForm.ts`, `profileFields.ts` | done |
| 2b | Experience and education editor | popup form, repeating entries | deferred |
| 3 | `resolveValue` and keys | `keys.ts`, `resolveValue.ts` | done |
| 4 | `discoverFields` | `discoverFields.ts`, `labels.ts` | done |
| 5 | Matchers | `matchField.ts`, `AttributeMatcher.ts`, `BareNameMatcher.ts` | done |
| 6a | Text filling | `setNativeValue.ts`, `TextFiller.ts` | done |
| 6b | Select, radio, checkbox fillers | `SelectFiller`, `RadioFiller`, `CheckboxFiller` | done |
| 6c | Combobox filler | `ComboboxFiller` | done |
| 7 | `fillPage`, `content.ts`, "Fill this page" button, highlight flagged fields | `fill/fillPage.ts`, `ui/highlightFlagged.ts` | done (checked by hand in Chrome on the fixture form; not yet on a real site). **First end-to-end result.** |
| 8 | LLM client and settings | `SettingsStore`, `GeminiLLMClient`, `BackgroundLLMClient`, `messaging.ts`, manifest `host_permissions` | 8a and 8b done (not yet confirmed against the real Gemini API) |
| 9 | Resume parsing and file upload | `extractText` (`pdfjs-dist`), a DOCX reader (to be chosen), `ResumeParser`, `ResumeUpload`, `IndexedDbResumeStore`, `FileFiller` | 9a (`parseResume`, `applyDraft`) done; 9b in progress |
| 10 | LLM fallback | prompt files for Calls A, B and C (option picking), background handlers, a machine-readable code on failed fills so ambiguity can be routed to the LLM, wired into `fillPage` | planned |
| 11 | Site adapters | `detectAdapter`, `GenericAdapter`, `GreenhouseAdapter`, then others | planned. The `SiteAdapter` interface will grow when the first adapter needs it. |
| 12 | Multi-step flow and login | `FlowRunner`, `CredentialVault`, `AuthHandler` | later |

**(Proposed adjustment):** `FileFiller` needs the resume file from the resume store, so it moves from 6c to step 9, where the store is built.

### Acceptance for the first usable version (after step 7)
Open a plain job application form, press "Fill this page", and see: name, email, phone, links and standard answers filled; text, select and radio fields handled; fields it could not fill highlighted; nothing overwritten; nothing submitted.

### Acceptance for the LLM version (after step 10)
Upload a resume, review and fix the parsed draft, save it, then fill a real application including unusual questions, with free-text answers drafted for review.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Real sites differ from the test fixtures | Fixtures from real forms; manual checks on real sites; adapters as overrides |
| Wrong match types wrong data | Confidence threshold; validation against the field; read-back check; flag instead of guess |
| LLM output is malformed or invented | Zod validation; a `none` option; user reviews drafts |
| Site redesigns break an adapter | The generic path still works; adapters are small and isolated |
| API cost | Batch one call per page; only unmatched fields go to the LLM |
| Credentials theft | Local vault, never sent to the LLM, passphrase-encrypted **(proposed)** |
| Accidental submission | Stop before submit by default |
| Scope creep | Only build the interfaces a step uses; later features stay as plug-in points |

## 13. Open decisions

1. ~~LLM provider~~ Decided: Google Gemini.
2. **Submit behavior:** stop before submit (current default) or go all the way.
3. **Vault design** for credentials (blocks step 12).
4. **DOCX support** and which library, or PDF only.
5. **Whether to add HTML fixtures** of real forms as test data.
6. **Overwrite policy:** currently never overwrite a different existing value; a setting could change that.

## 14. Future: autonomous mode

Each item is a plug-in behind an interface, not a rewrite:

- Job scraping or RAG → a `JobSource` interface.
- Tailored resumes → a `ResumeProvider` (today: the one uploaded file).
- Email verification codes → a `VerificationCodeProvider` (today: the user types the code). Reading mail needs OAuth and is high-stakes.
- Unattended applying runs in a headless browser and reuses `packages/core`, which is why the core has no `chrome.*` imports.
- A backend, if ever needed, swaps the `ProfileStore` and `LLMClient` implementations.
- Autonomous submit keeps a human approval step at first.

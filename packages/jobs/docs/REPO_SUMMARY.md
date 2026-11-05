# How the auto-applier repo works (read before building the job feed)

Read on 2026-11-04 from `main` at `1ba243a`. Baseline: `npm test` passes (core 691 tests, extension 228), `npm run typecheck` is clean.

## Layout

- npm workspaces (`packages/*`), TypeScript 7 strict, esbuild, Vitest 5, jsdom, Zod 4 through `zod/mini` only.
- `packages/core`: all logic, never imports `chrome.*`. Folders by job: `profile/`, `fields/`, `matching/`, `filling/`, `fill/`, `assist/`, `resume/`, `llm/`, `ports/`, `adapters/`, `testing/`. One public entry, `src/index.ts`, which re-exports everything.
- `packages/extension`: thin Chrome MV3 shell (popup, content script, background worker, storage). The only place `chrome.*` appears.
- Root: `package.json`, `package-lock.json`, `tsconfig.base.json`, `.gitignore`, `README.md`, the design notes file, `plan.md`, `fixtures/simple-application.html`.
- `plan.md` already names job scraping as a later plug-in behind a `JobSource` interface and lists it as a non-goal "for now".

## Conventions to match

- Formatting: no semicolons, double quotes, 2 spaces, trailing commas, lines up to about 120 characters. Relative imports without extensions, `import type` for types.
- Files are small and do one job: median 36 lines, largest source file 172. Tests sit next to the code as `name.test.ts` and run up to about 600 lines.
- Every file starts with a one-line comment saying what it does, and every function has a one-line comment above it (a written rule in the root design notes). Example: `// Returns the trimmed text, or undefined when it is blank.`
- Types for data, interfaces for behavior ("ports"), string-literal unions instead of enums, no mutation, no `console.log`, `textContent` never `innerHTML`.
- Stateless logic is plain functions (`parseResume`, `currentJob`, `skillsFrom`). Classes appear only where something holds settings or wraps another object (`GeminiLLMClient`, `RetryingLLMClient`, the storage classes).
- Dependencies are injected through an options object with defaults, which is how tests avoid the network: `{ fetchFn?: typeof fetch; timeoutMs?: number }`, `{ delaysMs?, sleep? }`.
- Errors: full sentences that say what to do, e.g. `"No Gemini API key is set. Add one in the extension's LLM settings."`. `LLMRequestError` carries `retryable`; `isRetryableStatus` treats 429, 500, 502, 503, 504 as temporary. Expected failures are returned as unions, not thrown: `{ ok: true; profile } | { ok: false; errors }`, `{ item } | { warning }`.
- Untrusted data (LLM output, storage) is checked with a lenient `zod/mini` schema at the edge, then cleaned by small functions.
- Tests: `describe("parseResume: location")`, plain-sentence test names (`"treats a missing or null location as blank"`), arrange / act / assert separated by blank lines, small commented helper factories (`modelAnswering(answer)` returning `{ completeJson: vi.fn(...) }`), fake `sleep` and `fetchFn`. DOM tests put `// @vitest-environment jsdom` on line 2.
- Commits: `feat:`, `fix:`, `docs:`, lowercase, specific, often listing two or three changes (`feat: retry temporary LLM failures and skip aria-hidden helper inputs`). Median subject length 61 characters. Docs are committed separately from code. No trailers.

## Profile and resume parsing

- `Profile` (`core/src/profile/types.ts`) = `personal` (names, email, phone, city/state/country, links), `experience[]` (company, title, dates, description), `education[]` (school, degree, field, dates), `skills: string[]`, `answers`, optional `notes`, optional `resume` pointer.
- `answers` has `workAuthorization` (free text such as "Citizen"), `isAuthorizedToWork` (boolean), `needsSponsorship` (boolean), optional `plansToWorkRemotely`, `noticePeriod`, `salaryExpectation`. This is too coarse for the job feed: it cannot tell F-1 CPT from OPT from STEM OPT, or "sponsorship later" from "now".
- `validateProfile(input: unknown)` checks a stored object and returns the union above.
- The extension saves the profile in `chrome.storage.local` under the key `profile` and the resume file in IndexedDB.
- Resume parsing is LLM-only. pdf.js turns the PDF into text (`extension/src/resume/pdfText.ts`, popup only), `parseResume(text, llm)` (core) asks the model for JSON and cleans it into a `ProfileDraft` plus warnings, then `buildProfileFromDraft` / `importResume` decide between "ready to save" and "needs review". There is no rule-based parser.
- LLM access: `createFallbackClient` builds Gemini first, Groq as backup, each wrapped in `RetryingLLMClient`. Keys live in `chrome.storage.local` under `llm-settings` and are used only by the background worker.

## What the job feed can reuse

- `Profile`, `validateProfile`, `currentJob`, `currentEducation` for skills, titles and school.
- `parseResume` and `ProfileDraft` for the optional LLM step, and `GeminiLLMClient` / `GroqLLMClient` / `createFallbackClient` (they take `fetchFn`, so they also work outside Chrome).
- The retry pattern and `isRetryableStatus` for polite fetching.
- Not reusable by import from core: the PDF reader lives in `packages/extension`.

## What must not be touched

- `packages/core/**`, `packages/extension/**`, and the root files above, including the design notes and `plan.md`.
- Two consequences to note in `INTEGRATION.md`: the root `test` and `typecheck` scripts name core and extension explicitly, so `packages/jobs` will not run in `npm test` until the final merge adds it; and running `npm install` with a new workspace rewrites `package-lock.json`.

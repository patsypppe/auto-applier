# Contributing to Auto Applier

Thanks for helping. This project is small and the rules are strict on purpose: the code fills in forms with people's personal data, so a careless change can type the wrong thing into a real job application. Read this whole file before you open a pull request. A pull request that ignores it will be closed without review.

## The short version

1. Pick an open issue. Comment "I'd like to take this" and **wait until a maintainer assigns it to you**. Do not start before that.
2. One issue per pull request. Do not mix in unrelated fixes or refactors.
3. Write the test first and watch it fail for the right reason. Then write the code.
4. `npm test`, `npm run typecheck` and `npm run build` must all pass.
5. Fill in the pull request template honestly, including what you did **not** test.

## Ground rules

### Decide before you build
- **The maintainers own the design.** If an issue is labelled `needs-design`, or you want to add a new interface, setting, dependency, file format or message type, open a discussion on the issue first and wait for a "go". Do not send a surprise redesign.
- Do not propose a competing architecture in a pull request. Questions and problems you find are welcome in the issue.
- Work that is not covered by an open issue needs an issue first.

### Scope
- Small pull requests. Aim for under 400 changed lines, excluding test fixtures. Bigger work is split into steps; ask in the issue how.
- No drive-by formatting, renaming or dependency bumps inside a feature pull request.

### Tests (mandatory)
- Test first (TDD): red, then green, then clean up. A bug fix needs a test that fails without the fix.
- Core logic is tested in Node. DOM code is tested in jsdom and the test file needs `// @vitest-environment jsdom` on its second line.
- Tests that touch `chrome.*` stub the global with `vi.stubGlobal`.
- New code needs tests for the normal case, the empty case and at least one failure case.
- Say plainly in the pull request what was **not** checked in a real browser. jsdom has no layout, so hidden fields and real focus behaviour need a manual check in Chrome.

### Architecture
- `packages/core` never imports `chrome.*`. Only `packages/extension` does.
- New behaviour is a new class behind an existing interface (a `Matcher`, a `Filler`, a `SiteAdapter`, an `LLMClient`), not an edit to the orchestrator.
- Build only what the issue needs. No speculative interfaces.

### Code style
- TypeScript, strict. String-literal unions instead of enums. `type` for data, `interface` for behaviour.
- Immutable: build new objects, never mutate.
- Small files with one clear job (about 200 to 400 lines; 800 is the hard limit).
- Readable code. One comment line at the top of every file saying what the file does, and one comment line above every function saying what it does. No other comments unless truly needed. JSON files have none.
- No `console.log` or leftover debug output.
- Never use `innerHTML` with dynamic data. Use `textContent`.
- Zod only at the edges, to validate untrusted data. `profile/types.ts` stays the source of truth for the `Profile` shape.
- Match the surrounding code. Do not reformat files you are not changing.

### Dependencies and bundle size
- **No new dependency without approval in the issue.** Say what it does, its size, its licence and why a few lines of code will not do.
- The content script runs in every frame of every page. Check `ls -l packages/extension/dist` before and after, and put both sizes in the pull request. Import Zod only as `import * as z from "zod/mini"`. pdf.js is imported from popup code only.

### Privacy and security (the strictest rules)
- **Never commit personal data**: no real profile, resume, API key, token, cookie, email address, phone number or application answers. Not in code, tests, fixtures, screenshots, logs or commit history.
- Test fixtures made from real application pages must be anonymised: remove names, emails, tokens, tracking ids and company-specific hidden fields. Keep the structure: labels, attributes and classes. The fixture issues list exactly what to remove.
- API keys stay in the background worker. They never reach the content script, the page, a log or an error message.
- Page text is untrusted. Anything from a page that goes into a prompt must stay marked as untrusted.
- Nothing may be sent to a new network address without an issue that says so, a matching `host_permissions` entry and a line in the README's list of what leaves the browser.
- The extension stops before submit. A change that clicks Submit, Next or Apply for the user needs a maintainer decision first.
- Found a vulnerability? Do **not** open a public issue. Follow [SECURITY.md](SECURITY.md).

### Behaviour that must not regress
- Never overwrite a value the user already typed.
- Never tick a single consent checkbox.
- When unsure, flag the field for the user instead of guessing.
- Every outcome is reported (`filled`, `skipped`, `failed`, `unmatched`, `no-value`). Nothing fails silently.

## Setting up

```bash
git clone https://github.com/patsypppe/auto-applier.git
cd auto-applier
npm install
npm test
npm run typecheck
npm run build
```

Load `packages/extension/dist` in `chrome://extensions` (Developer mode, Load unpacked). After a change, build, then press the reload arrow on the extension card and reload the job page. To try it without a real site:

```bash
python3 -m http.server 8000 -d fixtures
# open http://localhost:8000/simple-application.html
```

Developed on Node 26 and npm 11. Other versions are untested; if you find that one works or breaks, say so in an issue.

## Workflow

1. Fork the repo and branch from `main`: `feat/short-name`, `fix/short-name`, `docs/short-name`, `test/short-name` or `chore/short-name`.
2. Keep your branch up to date by rebasing on `main`. No merge commits in your branch.
3. Commit messages: `<type>: <description>` where type is `feat`, `fix`, `refactor`, `docs`, `test` or `chore`. Present tense, under 72 characters on the first line, one logical change per commit.
4. Open the pull request against `main` and link the issue with `Closes #123`.
5. Wait for CI. A red pull request is not reviewed.
6. Answer review comments with commits (no force-push while review is under way), and mark conversations resolved only when you have fixed them.
7. Maintainers squash-merge.

## Review standard

A pull request is merged only when:

- CI is green and the template is complete.
- Tests cover the change and fail without it.
- It does what the issue says, and nothing else.
- It follows every rule in this file.
- A maintainer has approved it. Authors do not merge their own pull requests.

Changes to privacy, security, the Profile shape or anything that touches the LLM prompts get a second review.

## Using AI tools

Allowed, but you are the author. You must understand every line you submit, you must have run the tests yourself, and you must say in the pull request if a tool wrote a substantial part. Pull requests that look like unreviewed bulk output (large, untested, off-topic, invented files or APIs) are closed.

## Issues

- Search first. One problem per issue.
- Use the bug or feature template. For a bug on a real job site, include the site and ATS name (Greenhouse, Lever, Workday and so on), the field label as shown, what you expected and what happened, and the **outline colour** and `data-auto-applier-reason` text on the field. Remove personal data from anything you paste.
- Do not comment "+1" or "any update?". Use a reaction.

## Conduct

Be kind and be specific. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Maintainers may close, lock or remove anything that breaks it.

## Licence

The project does not have a licence file yet (tracked in an open issue). Until one exists, do not assume your contribution may be reused outside this repository; by opening a pull request you agree it can be merged under the licence the maintainers choose.

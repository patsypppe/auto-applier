# Merging the job feed

This branch only adds `packages/jobs`. These changes outside it are needed when the branches are merged, and were left alone here on purpose.

## Root

- `package.json`: the `test` and `typecheck` scripts name core and the extension explicitly. Add `npm run test -w @auto-applier/jobs` and `tsc -p packages/jobs --noEmit`.
- `package-lock.json`: gains the `@auto-applier/jobs` workspace entry on the next `npm install`. This branch never ran `npm install`, so the lockfile is unchanged. Until that entry exists, `npm ci` on this branch stops with "Missing: @auto-applier/jobs@0.1.0 from lock file". `npm install`, which the README uses, works and adds the entry.

## Extension (only if the feed moves into the extension)

- `public/manifest.json`: host permissions for `https://boards-api.greenhouse.io/*`, `https://api.lever.co/*`, `https://api.ashbyhq.com/*`, and later `https://*.myworkdayjobs.com/*`.
- `build.mjs`: an entry for a jobs page.
- New files: the page, plus code that reads and writes `FeedData` in `chrome.storage.local` or IndexedDB and calls `getJobs` and `applyFilters`.

## Core

Nothing yet. The jobs package imports `Profile`, `validateProfile`, `isRetryableStatus`, `parseResume` and `createFallbackClient`. If any of those change name or shape on the autofill branch, the jobs package must follow.

## Docs

- `README.md`: a short section that points to `packages/jobs/README.md`.
- The root design notes and `plan.md` belong to the autofill side. Whoever merges decides whether to mention the jobs package there.

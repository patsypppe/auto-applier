# Security policy

## Reporting a vulnerability

Do not open a public issue. Use GitHub's private vulnerability reporting: the repository's **Security** tab, then **Report a vulnerability**. Include what you found, how to reproduce it, and what an attacker could do.

You will get a reply within 7 days. Please give us a reasonable time to fix the problem before you tell anyone else.

## What counts

- API keys, profile data or resume contents reaching a web page, a log, an error message or any server that the README does not list.
- A web page making the extension fill, read or send something it should not (for example through the messages between content script, popup and background worker).
- Prompt injection from page text that makes the AI reveal profile data to the page or fill fields it was not asked about.
- Cross-site scripting in the popup or the local feed page.
- Any way for the local feed server (`packages/jobs`) to be reached from outside this computer.

## What does not

- Problems that need an attacker who already controls your computer or your Chrome profile.
- The API keys being stored in plain text in `chrome.storage.local`. That is a known, documented limit and has its own open issue.

## Supported versions

Only the current `main` branch.

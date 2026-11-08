// Renders the "Application link" box: the person pastes a job link and the extension opens it, finds Apply and fills the form.
import { isApplyToLinkResponse } from "../messaging"
import type { ApplyToLinkRequest } from "../messaging"

const NOT_A_LINK = "Paste a web address that starts with http:// or https://."
const OPENED = "Opened in a new tab. Watch it there: it looks for Apply, fills each page, and stops before Submit."
const NO_WORKER = "Could not reach the extension. Reload the extension in chrome://extensions and try again."

// Returns the text as a web address, or undefined when it is not an http or https link.
function asWebAddress(text: string): string | undefined {
  try {
    const url = new URL(text.trim())
    return url.protocol === "http:" || url.protocol === "https:" ? text.trim() : undefined
  } catch {
    return undefined
  }
}

// Asks the background worker to open the link; returns the message to show.
async function openLink(url: string): Promise<string> {
  const request: ApplyToLinkRequest = { type: "apply-to-link", url }
  try {
    const reply: unknown = await chrome.runtime.sendMessage(request)
    if (!isApplyToLinkResponse(reply)) return NO_WORKER
    return reply.ok ? OPENED : reply.error
  } catch {
    return NO_WORKER
  }
}

// Adds the link box, the button and a status line to the container.
export function mountApplyPanel(container: HTMLElement): void {
  const label = document.createElement("label")
  label.htmlFor = "application-link"
  label.textContent = "Application link"

  const input = document.createElement("input")
  input.id = "application-link"
  input.type = "url"
  input.placeholder = "https://company.com/jobs/123"

  const button = document.createElement("button")
  button.type = "button"
  button.textContent = "Open and apply"

  const status = document.createElement("p")
  status.setAttribute("role", "status")

  button.addEventListener("click", async () => {
    const url = asWebAddress(input.value)
    if (!url) {
      status.textContent = NOT_A_LINK
      return
    }
    status.textContent = "Opening…"
    status.textContent = await openLink(url)
  })

  container.append(label, input, button, status)
}

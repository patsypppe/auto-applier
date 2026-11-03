// Collects a job page's title, description and main text, without forms, menus or scripts, as background for drafting answers.
const MAX_CONTEXT_CHARS = 6000
const NOISE = "script, style, noscript, nav, header, footer, form, svg, template"
const BLOCKS = "h1, h2, h3, h4, h5, h6, p, li, ul, ol, div, section, article, main, tr, td, dt, dd, br"

// Reads the text of the main content of the page, keeping words in different blocks apart.
function mainText(doc: Document): string {
  const root = doc.querySelector("main, [role='main'], article") ?? doc.body
  if (!root) return ""

  const copy = root.cloneNode(true) as Element
  copy.querySelectorAll(NOISE).forEach((element) => element.remove())
  copy.querySelectorAll(BLOCKS).forEach((element) => element.after(" "))
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim()
}

// Returns the page title, description and main text as one block of text, cut to a sensible length.
export function collectJobContext(doc: Document): string {
  const title = doc.title.trim()
  const description = doc.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() ?? ""
  const text = mainText(doc)

  const parts = [
    title === "" ? "" : `Page title: ${title}`,
    description === "" ? "" : `Description: ${description}`,
    text,
  ].filter((part) => part !== "")

  return parts.join("\n\n").slice(0, MAX_CONTEXT_CHARS)
}

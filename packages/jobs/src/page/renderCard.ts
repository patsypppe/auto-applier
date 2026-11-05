// Builds one job card for the feed page. Every piece of text from a posting is set with textContent, never as HTML.
import { APPLICATION_STATUSES, type AppliedEntry, type ApplicationStatus } from "../feed/applied"
import type { Card } from "../feed/card"
import { historySentence } from "../history/historySentence"
import type { Degree, Effect, JobType, Pay } from "../types"

const EFFECT_LABELS: Record<Effect, string> = {
  blocked: "Blocked for you",
  "likely-blocked": "Likely blocked for you",
  ok: "Work authorization",
  positive: "A plus for you",
}

// Returns a saved time as a YYYY-MM-DD date in the user's own time zone, so an evening change shows that day.
export function localDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA")
}

// Makes an element with an optional class and text.
function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const made = document.createElement(tag)
  if (className) made.className = className
  if (text !== undefined) made.textContent = text
  return made
}

// Makes a link that opens in a new tab, and only to http or https addresses, so a "javascript:" link from a posting does nothing.
function link(url: string, text: string): HTMLAnchorElement {
  const made = element("a", undefined, text)
  made.setAttribute("href", /^https?:\/\//i.test(url) ? url : "#")
  made.target = "_blank"
  made.rel = "noopener noreferrer"
  return made
}

// Lists the skills the user has and lacks, and the years and degree the posting asks for.
function skillsLine(card: Card): HTMLElement {
  const { matchedSkills, missingSkills, yearsRequired, degreeRequired } = card.reasons
  const parts = [`You have: ${matchedSkills.join(", ") || "none named"}`, `Missing: ${missingSkills.join(", ") || "none"}`]
  if (yearsRequired !== undefined) parts.push(`Asks for ${yearsRequired}+ years`)
  if (degreeRequired) parts.push(`Needs ${DEGREE_LABELS[degreeRequired]}`)
  return element("p", "skills", parts.join(" · "))
}

const DEGREE_LABELS: Record<Degree, string> = { associate: "an associate's", bachelor: "a bachelor's", master: "a master's", phd: "a PhD" }

const JOB_TYPE_LABELS: Record<JobType, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  intern: "Intern",
  temporary: "Temporary",
}

// Writes an amount with thousands commas and cents only when there are some: 95000 as "95,000", 25.5 as "25.50".
function amount(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })
}

// Writes the pay range, such as "Pay: $95,000 to $115,000 a year" or "Pay: CAD 166,600 to 182,000 a year".
function payText(pay: Pay): string {
  const [low, high] = pay.currency === "USD" ? [`$${amount(pay.min)}`, `$${amount(pay.max)}`] : [`${pay.currency} ${amount(pay.min)}`, amount(pay.max)]
  return `Pay: ${low} to ${high} ${pay.per === "year" ? "a year" : "an hour"}`
}

// Lists the job type and workplace the board gives, such as "Intern, hybrid", or returns undefined when it gives neither.
function kindText(card: Card): string | undefined {
  const parts = [card.jobType ? JOB_TYPE_LABELS[card.jobType] : undefined, card.workplace].filter((part) => part !== undefined)
  return parts.length > 0 ? parts.join(", ") : undefined
}

// Shows each work-authorization tag as a chip that opens to its evidence sentence and the sentences around it.
function tagsBlock(card: Card): HTMLElement {
  const block = element("div", `tags ${card.effect}`)
  block.append(element("span", "effect", EFFECT_LABELS[card.effect]))
  for (const found of card.tags) {
    const chip = element("details", `tag ${found.tag}`)
    chip.append(element("summary", undefined, found.tag.replaceAll("-", " ")))
    if (found.context) chip.append(element("p", "evidence", found.context))
    block.append(chip)
  }
  return block
}

// Makes the status menu, showing since when the current status holds, and reports each change.
function statusBlock(applied: AppliedEntry | undefined, onStatus: (status: ApplicationStatus | "none") => void): HTMLElement {
  const block = element("div", "status")
  const select = element("select")
  select.append(element("option", undefined, "Not tracked"))
  select.options[0]!.value = "none"
  for (const status of APPLICATION_STATUSES) {
    const option = element("option", undefined, status[0]!.toUpperCase() + status.slice(1))
    option.value = status
    select.append(option)
  }
  select.value = applied?.status ?? "none"
  select.addEventListener("change", () => onStatus(select.value as ApplicationStatus | "none"))
  block.append(select)

  const since = applied?.changes.at(-1)?.date
  if (since) block.append(element("span", "since", `since ${localDate(since)}`))
  return block
}

// Builds the card: title link, company, places, date and score, then skills, tags, other links and the status menu.
export function renderCard(card: Card, applied: AppliedEntry | undefined, onStatus: (status: ApplicationStatus | "none") => void): HTMLElement {
  const article = element("article", "card")

  const heading = element("h2")
  heading.append(link(card.url, card.title))
  article.append(heading)

  const posted = card.postedAt ? `posted ${card.postedAt.slice(0, 10)}` : `first seen ${card.firstSeenAt.slice(0, 10)}`
  article.append(element("p", "meta", `${card.company} · ${card.locations.join("; ")} · ${posted}`))
  article.append(element("span", "score", String(card.score)))
  const kind = kindText(card)
  const facts = [kind, card.pay ? payText(card.pay) : undefined].filter((part) => part !== undefined)
  if (facts.length > 0) article.append(element("p", "facts", facts.join(" · ")))
  article.append(skillsLine(card), tagsBlock(card))
  if (card.history) article.append(element("p", "history", historySentence(card.history)))

  const others = (card.copies ?? []).filter((copy) => copy.url !== card.url)
  if (others.length > 0) {
    const also = element("p", "copies", "Also listed at: ")
    others.forEach((copy, index) => {
      if (index > 0) also.append(", ")
      also.append(link(copy.url, copy.locations.join("; ") || copy.id))
    })
    article.append(also)
  }

  article.append(statusBlock(applied, onStatus))
  return article
}

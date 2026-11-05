// Reads the pay range a posting states in its text, such as "$95,000 - $115,000" or "$22.00 - $25.00 per hour".
import type { Pay } from "../types"

// An amount such as "$120,000", "$120,000.00", "$120K" or "$120,000 USD"; the second amount of a range may leave out the "$".
const AMOUNT = String.raw`(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s?([kK])?(?:\s?USD)?`
// Dashes may come through as "&mdash;" or "&ndash;", which some boards leave escaped in their pay boxes.
const DASH = String.raw`(?:-|–|—|to|and|&mdash;|&ndash;|&#821[12];)`
const RANGE = new RegExp(String.raw`\$\s?${AMOUNT}\s*${DASH}\s*\$?\s?${AMOUNT}`, "g")
const HOURLY = /^\s*(\/\s*h(ou)?r\b|per hour|an hour|hourly|\/hour)/i
const NOT_PAY = /^\s*(million|billion|mm\b|m\b|b\b)/i
// Pay by the month, week or day, which the feed does not compare: "$10,000 - $12,000 per month".
const OTHER_PERIOD = /^\s*(USD\s*)?(\/\s*|per\s+|a\s+|an\s+|each\s+|every\s+)?(month|week|day|mo\b|wk\b)/i
// Money for something other than pay, named just before the range: "New hire equity: $16,000-$24,000".
const OTHER_MONEY_BEFORE = /\b(equity|stock|RSUs?|refresh|bonus|relocation|stipend|signing|sign-on|commission)\b[^.\n$]{0,30}$/i

const LIMITS = { year: [10_000, 2_000_000], hour: [5, 500] } as const

// Returns true when a range in US dollars is a believable yearly or hourly pay, so a $6,000 internship stipend a board
// marks as yearly is left out. Other currencies are not checked, since their amounts differ too much.
export function isSensiblePay({ min, max, per, currency }: Pick<Pay, "min" | "max" | "per" | "currency">): boolean {
  if (min > max) return false
  if (currency !== "USD") return true
  const [low, high] = LIMITS[per]
  return min >= low && max <= high
}

// Turns the parts of one amount ("120,000", "50", "K") into a number.
function amountOf(whole: string | undefined, cents: string | undefined, thousands: string | undefined): number {
  const value = Number(`${(whole ?? "").replaceAll(",", "")}.${cents ?? "0"}`)
  return thousands ? value * 1000 : value
}

// Returns the range one match states, or undefined when it is not pay, such as funding in millions.
function rangeOf(match: RegExpMatchArray, before: string, after: string): Omit<Pay, "currency" | "from"> | undefined {
  if (NOT_PAY.test(after) || OTHER_PERIOD.test(after) || OTHER_MONEY_BEFORE.test(before)) return undefined
  const min = amountOf(match[1], match[2], match[3])
  const max = amountOf(match[4], match[5], match[6])
  const per = HOURLY.test(after) ? "hour" : min >= LIMITS.year[0] ? "year" : undefined
  return per && isSensiblePay({ min, max, per, currency: "USD" }) ? { min, max, per } : undefined
}

// Returns the pay range the text states, from the lowest to the highest of every range it lists (one per level or
// place), or undefined when it states none. Yearly ranges win over hourly ones when a posting has both.
export function readPay(text: string): Pay | undefined {
  const ranges = [...text.matchAll(RANGE)].flatMap((match) => {
    const start = match.index ?? 0
    const end = start + match[0].length
    return rangeOf(match, text.slice(Math.max(0, start - 40), start), text.slice(end, end + 25)) ?? []
  })
  const per = ranges.some((range) => range.per === "year") ? "year" : "hour"
  const same = ranges.filter((range) => range.per === per)
  if (same.length === 0) return undefined

  return { min: Math.min(...same.map((range) => range.min)), max: Math.max(...same.map((range) => range.max)), currency: "USD", per, from: "text" }
}

// Tests that readPay finds the pay range a posting states, in the wordings seen in real postings, and ignores other money.
import { describe, expect, test } from "vitest"
import { readPay } from "./pay"

describe("readPay", () => {
  test.each([
    ["Estimated Salary Range: $95,000 - $115,000", 95000, 115000],
    ["Salary Range: $120K-$150K", 120000, 150000],
    ["The San Francisco, CA OTE range for this role is $221,000.00 - $300,000.00.", 221000, 300000],
    ["The base pay range for this opening is $126,347 to $164,252.", 126347, 164252],
    ["The total annual salary for this full-time position in this location is $243,000–$364,000 + equity + benefits", 243000, 364000],
    ["For this position we are targeting a base pay between $60,000 and $75,000.", 60000, 75000],
    ["$113,400 - $162,000 a year", 113400, 162000],
    ["$219,800&mdash;$274,700 USD", 219800, 274700],
    ["the expected salary range for this position is $174,000 USD - $206,000 USD, plus bonus eligibility", 174000, 206000],
    ["Tier 1 (NYC/SF Bay Area/Seattle): $200,000 - 225,000 annually", 200000, 225000],
  ])("reads %s as a yearly range", (text, min, max) => {
    expect(readPay(text)).toEqual({ min, max, currency: "USD", per: "year", from: "text" })
  })

  test.each([
    ["The base salary range for this position is $22.00- $25.00 per hour, influenced by several factors.", 22, 25],
    ["Earn $16-$17/hr plus up to $300 in bonuses in your first 90 days.", 16, 17],
  ])("reads %s as an hourly range", (text, min, max) => {
    expect(readPay(text)).toEqual({ min, max, currency: "USD", per: "hour", from: "text" })
  })

  test("spans every level or place a posting lists, from the lowest to the highest", () => {
    const text = "Level 1: $105,000.00 - $122,500.00\nLevel 2: $120,000.00 - $150,000.00\nLevel 3: $140,000.00 - $235,000.00"

    expect(readPay(text)).toMatchObject({ min: 105000, max: 235000, per: "year" })
  })

  test.each([
    ["This role includes a $5,000 sign-on bonus."],
    ["We raised $120M - $150M in our last round."],
    ["The company has $20-$30 million in revenue."],
    ["Up to $300 in bonuses."],
    ["New hire equity: $16,000-$24,000"],
    ["The base compensation range for this position is $10,000 - $12,000 per month."],
    ["Interns earn $2,500 - $3,000 a week."],
    ["A relocation stipend of $10,000 - $15,000 is available."],
    ["No pay is stated here."],
  ])("finds no pay range in %s", (text) => {
    expect(readPay(text)).toBeUndefined()
  })
})

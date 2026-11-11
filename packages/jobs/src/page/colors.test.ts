// Tests that the page's colours are readable in light and dark mode: text at least 4.5 to 1 on the background and control
// borders at least 3 to 1 (WCAG 2.2 AA), worked out from the colours in index.html with the WCAG formula.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

const CSS = readFileSync(join(import.meta.dirname, "index.html"), "utf8")

// Reads the --name: #hex colours from the first :root block after the given text.
function colorsAfter(marker: string): Record<string, string> {
  const block = CSS.slice(CSS.indexOf(marker)).match(/:root\s*{([^}]*)}/)![1]!
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([, name, hex]) => [name!, hex!]))
}

// Returns the WCAG relative luminance of a #rrggbb colour.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

// Returns the WCAG contrast ratio between two colours.
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light! + 0.05) / (dark! + 0.05)
}

const THEMES = { light: colorsAfter("<style>"), dark: colorsAfter("prefers-color-scheme: dark") }

describe("the page's colours", () => {
  test.each(Object.entries(THEMES))("give text at least 4.5 to 1 and control borders at least 3 to 1 in %s mode", (_, colors) => {
    for (const name of ["text", "muted", "blocked", "likely", "plus"]) expect(contrast(colors[name]!, colors.bg!), name).toBeGreaterThanOrEqual(4.5)
    expect(contrast(colors.control!, colors.bg!), "control").toBeGreaterThanOrEqual(3)
  })

  test("give controls the readable border and never fade a card with opacity", () => {
    expect(CSS).toMatch(/input, select, button \{[^}]*border: 1px solid var\(--control\)/)
    expect(CSS).not.toMatch(/opacity/)
  })
})

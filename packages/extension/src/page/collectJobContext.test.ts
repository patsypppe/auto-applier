// Tests that the job page's title, description and main text are collected without forms, menus or scripts.
// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from "vitest"
import { collectJobContext } from "./collectJobContext"

// Loads a page with the given title, optional meta description and body.
function loadPage(body: string, { title = "", description = "" } = {}): void {
  document.head.innerHTML = description ? `<meta name="description" content="${description}">` : ""
  document.title = title
  document.body.innerHTML = body
}

beforeEach(() => {
  loadPage("")
})

describe("collectJobContext", () => {
  test("includes the page title, the description and the main text", () => {
    loadPage("<main><h1>Software Engineer</h1><p>We build billing tools.</p></main>", {
      title: "Software Engineer at Example Co.",
      description: "Join our payments team.",
    })

    const context = collectJobContext(document)

    expect(context).toContain("Page title: Software Engineer at Example Co.")
    expect(context).toContain("Description: Join our payments team.")
    expect(context).toContain("Software Engineer We build billing tools.")
  })

  test("prefers the main content over the rest of the page", () => {
    loadPage("<p>Cookie notice</p><main>The role</main><p>Footer links</p>")

    const context = collectJobContext(document)

    expect(context).toContain("The role")
    expect(context).not.toContain("Cookie notice")
  })

  test("falls back to an article, then to the whole body", () => {
    loadPage("<p>Intro</p><article>The article text</article>")
    expect(collectJobContext(document)).toContain("The article text")
    expect(collectJobContext(document)).not.toContain("Intro")

    loadPage("<p>Only a body paragraph</p>")
    expect(collectJobContext(document)).toContain("Only a body paragraph")
  })

  test("leaves out scripts, styles, menus, headers, footers and the application form", () => {
    loadPage(`
      <header>Site header</header>
      <nav>Home Jobs About</nav>
      <script>var secret = 1</script>
      <style>.x { color: red }</style>
      <noscript>Enable JavaScript</noscript>
      <p>The real description</p>
      <form><label>First name</label><input /></form>
      <footer>Site footer</footer>`)

    const context = collectJobContext(document)

    expect(context).toContain("The real description")
    for (const noise of ["Site header", "Home Jobs", "secret", "color: red", "Enable JavaScript", "First name", "Site footer"]) {
      expect(context).not.toContain(noise)
    }
  })

  test("collapses runs of whitespace", () => {
    loadPage("<main>One\n\n   two\t\tthree</main>")

    expect(collectJobContext(document)).toContain("One two three")
  })

  test("does not change the page it reads", () => {
    loadPage("<main>Keep <form>this form</form></main>")

    collectJobContext(document)

    expect(document.querySelector("form")?.textContent).toBe("this form")
  })

  test("cuts a very long page", () => {
    loadPage(`<main>START ${"z".repeat(20000)}</main>`)

    const context = collectJobContext(document)

    expect(context).toContain("START")
    expect(context.length).toBeLessThanOrEqual(6000)
  })

  test("returns nothing for an empty page", () => {
    loadPage("")

    expect(collectJobContext(document)).toBe("")
  })
})

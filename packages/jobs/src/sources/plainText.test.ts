// Tests that htmlToText turns job description HTML, including Greenhouse's escaped HTML, into readable plain text.
import { describe, expect, test } from "vitest"
import { htmlToText } from "./plainText"

describe("htmlToText", () => {
  test("removes tags and keeps the words", () => {
    expect(htmlToText("<p>Build <strong>data</strong> pipelines.</p>")).toBe("Build data pipelines.")
  })

  test("puts paragraphs, list items and line breaks on their own lines", () => {
    const html = "<h2>About you</h2><ul><li>Python</li><li>SQL</li></ul><p>Remote<br>US only</p>"

    expect(htmlToText(html)).toBe("About you\nPython\nSQL\nRemote\nUS only")
  })

  test("reads HTML that was escaped once, as Greenhouse sends it", () => {
    const escaped = "&lt;p&gt;We are unable to sponsor visas.&lt;/p&gt;&lt;p&gt;U.S. only.&lt;/p&gt;"

    expect(htmlToText(escaped)).toBe("We are unable to sponsor visas.\nU.S. only.")
  })

  test("decodes named and numeric entities", () => {
    expect(htmlToText("R&amp;D &quot;team&quot; &#8217;s &#x2014; caf&#233;&nbsp;bar")).toBe(
      "R&D \"team\" ’s — café bar",
    )
  })

  test("leaves escaped angle brackets in plain text alone after decoding", () => {
    expect(htmlToText("<p>Salary &amp;lt; $100k</p>")).toBe("Salary &lt; $100k")
  })

  test("squashes runs of spaces and drops blank lines", () => {
    expect(htmlToText("<div>  One \n\n  two  </div>\n\n<div>three</div>")).toBe("One two\nthree")
  })

  test("drops scripts and styles with their contents", () => {
    expect(htmlToText("<style>p{color:red}</style><p>Hi</p><script>alert(1)</script>")).toBe("Hi")
  })
})

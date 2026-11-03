// Bundles the extension's scripts with esbuild and copies static files into dist.
import { build } from "esbuild"
import { cp, mkdir, rm } from "node:fs/promises"

await rm("dist", { recursive: true, force: true })
await mkdir("dist", { recursive: true })

await build({
  entryPoints: {
    background: "src/background.ts",
    content: "src/content.ts",
    popup: "src/popup/popup.ts",
  },
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome120",
  sourcemap: true,
})

await cp("public", "dist", { recursive: true })

// pdf.js loads its worker and its standard fonts as separate files, so they ship inside the extension.
const pdfjsFolder = new URL("../../node_modules/pdfjs-dist/", import.meta.url)
await cp(new URL("build/pdf.worker.min.mjs", pdfjsFolder), "dist/pdf.worker.min.mjs")
await cp(new URL("standard_fonts", pdfjsFolder), "dist/standard_fonts", { recursive: true })
await cp("src/popup/popup.html", "dist/popup.html")

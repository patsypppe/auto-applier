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
await cp("src/popup/popup.html", "dist/popup.html")

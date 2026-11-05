// Bundles the job feed's command line tool and its feed page with esbuild, so Node and the browser can run them.
import { build } from "esbuild"
import { cp, rm } from "node:fs/promises"

await rm("dist", { recursive: true, force: true })

await build({
  entryPoints: { cli: "src/cli.ts" },
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
})

await build({
  entryPoints: { page: "src/page/page.ts" },
  outdir: "dist",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  sourcemap: true,
})

await cp("src/page/index.html", "dist/index.html")

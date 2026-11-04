// Bundles the job feed's command line tool with esbuild, so Node can run it without a TypeScript loader.
import { build } from "esbuild"
import { rm } from "node:fs/promises"

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

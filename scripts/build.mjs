import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.js",
  format: "cjs",
  target: ["node14", "chrome94"],
});
await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/index.esm.js",
  format: "esm",
  target: ["node14", "chrome94"],
});

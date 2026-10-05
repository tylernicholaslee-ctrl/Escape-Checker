import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { GET as getHealth } from "../api/healthz.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const required = [
  "public/index.html",
  "public/assets/app.js",
  "public/assets/styles.css",
  "api/fires.js",
  "api/healthz.js",
  "vercel.json",
  "scripts/build.mjs",
];

for (const path of required) {
  await access(new URL(path, `file://${root}`));
}

for (const path of ["public/assets/app.js", "api/fires.js", "api/healthz.js", "scripts/dev.mjs", "scripts/build.mjs"]) {
  const result = spawnSync(process.execPath, ["--check", `${root}${path}`], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

const vercelConfig = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
if (vercelConfig.buildCommand !== "npm run build" || vercelConfig.outputDirectory !== "dist") {
  throw new Error("vercel.json build settings are not configured as expected");
}

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
if (packageJson.scripts?.build !== "node scripts/build.mjs") {
  throw new Error("package.json is missing the expected build script");
}

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
for (const asset of ["/assets/styles.css", "/assets/app.js", "/favicon.svg"]) {
  if (!html.includes(asset)) {
    throw new Error(`index.html is missing ${asset}`);
  }
}

const health = getHealth();
if (health.status !== 200 || (await health.json()).status !== "ok") {
  throw new Error("Health function failed its local smoke test");
}

console.log("JSON config, static assets, JavaScript syntax, and API health smoke test passed.");

import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const distDir = fileURLToPath(new URL("../dist/", import.meta.url));

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(publicDir, distDir, { recursive: true });

console.log(`Built static site to ${distDir.replace(projectRoot, "")}`);

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { GET as getFires } from "../api/fires.js";
import { GET as getHealth } from "../api/healthz.js";

const root = fileURLToPath(new URL("../public/", import.meta.url));
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

async function sendWebResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function serveStatic(pathname, res) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const relative = normalize(decodeURIComponent(requested)).replace(/^[/\\]+/, "");
  const filePath = join(root, relative);

  if (!filePath.startsWith(root)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not a file");
    const body = await readFile(filePath);
    res.setHeader(
      "Content-Type",
      contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
    );
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/api/healthz") {
      await sendWebResponse(res, getHealth());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/fires") {
      await sendWebResponse(res, await getFires());
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, HEAD");
      res.end("Method not allowed");
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.end("Internal server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Escape Route Check running at http://127.0.0.1:${port}`);
});

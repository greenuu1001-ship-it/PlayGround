import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(process.env.SERVE_DIR || join(projectRoot, "dist"));
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

const types = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".glb": "model/gltf-binary",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

if (!existsSync(join(root, "index.html"))) {
  console.error(`Static output is missing index.html in ${root}`);
  process.exit(1);
}

function resolveFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return { status: 400 };
  }
  const candidate = resolve(root, "." + decoded);
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return { status: 403 };
  }
  try {
    const info = statSync(candidate);
    if (info.isDirectory()) {
      const index = join(candidate, "index.html");
      return existsSync(index) ? { status: 200, file: index, size: statSync(index).size } : { status: 404 };
    }
    return { status: 200, file: candidate, size: info.size };
  } catch {
    if (!extname(candidate)) {
      const fallback = join(root, "index.html");
      return { status: 200, file: fallback, size: statSync(fallback).size };
    }
    return { status: 404 };
  }
}

const server = createServer((request, response) => {
  if (request.url === "/__health") {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    response.end("ok\n");
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method not allowed\n");
    return;
  }
  let pathname;
  try {
    pathname = new URL(request.url || "/", "http://localhost").pathname;
  } catch {
    response.writeHead(400);
    response.end("Bad request\n");
    return;
  }
  const resolved = resolveFile(pathname);
  if (resolved.status !== 200) {
    const label = resolved.status === 404 ? "Not found\n" : resolved.status === 403 ? "Forbidden\n" : "Bad request\n";
    response.writeHead(resolved.status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    response.end(label);
    return;
  }
  const extension = extname(resolved.file).toLowerCase();
  response.writeHead(200, {
    "Content-Type": types[extension] || "application/octet-stream",
    "Content-Length": resolved.size,
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = createReadStream(resolved.file);
  stream.on("error", () => {
    if (!response.headersSent) {
      response.writeHead(500);
    }
    response.end();
  });
  stream.pipe(response);
});

server.on("error", (error) => {
  console.error(`Server error: ${error.message}`);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`Serving ${root} on http://${host}:${port}`);
});

function shutdown(signal) {
  console.log(`Received ${signal}, stopping server`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

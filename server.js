"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createStore } = require("./db");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > 100 * 1024) {
        reject(Object.assign(new Error("Payload too large"), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString() || "{}"));
      } catch {
        reject(Object.assign(new Error("Invalid JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function validate(input) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!title || title.length > 100) return { error: "Title is required (max 100 characters)" };
  if (!body || body.length > 10000) return { error: "Body is required (max 10000 characters)" };
  const rawTags = Array.isArray(input.tags) ? input.tags : [];
  const seen = new Set();
  const tags = rawTags
    .map((t) => String(t).trim().toLowerCase().replace(/^#/, ""))
    .filter((t) => t && t.length <= 30 && !seen.has(t) && seen.add(t))
    .slice(0, 20);
  return { value: { title, body, tags } };
}

function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "/index.html" : pathname;
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

async function main() {
  const store = await createStore();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const { pathname } = url;

    try {
      if (pathname === "/api/health") return send(res, 200, { ok: true, db: store.kind });

      if (pathname === "/api/tags" && req.method === "GET") {
        return send(res, 200, await store.tags());
      }

      if (pathname === "/api/notes") {
        if (req.method === "GET") {
          const tag = (url.searchParams.get("tag") || "").toLowerCase() || undefined;
          const q = url.searchParams.get("q") || undefined;
          return send(res, 200, await store.list({ tag, q }));
        }
        if (req.method === "POST") {
          const { value, error } = validate(await readJson(req));
          if (error) return send(res, 400, { error });
          return send(res, 201, await store.create(value));
        }
        return send(res, 405, { error: "Method not allowed" });
      }

      const m = pathname.match(/^\/api\/notes\/(\d+)$/);
      if (m) {
        const id = Number(m[1]);
        if (req.method === "PUT") {
          const { value, error } = validate(await readJson(req));
          if (error) return send(res, 400, { error });
          const note = await store.update(id, value);
          return note ? send(res, 200, note) : send(res, 404, { error: "Note not found" });
        }
        if (req.method === "DELETE") {
          const ok = await store.remove(id);
          return ok ? send(res, 200, { ok: true }) : send(res, 404, { error: "Note not found" });
        }
        return send(res, 405, { error: "Method not allowed" });
      }

      if (pathname.startsWith("/api/")) return send(res, 404, { error: "Not found" });

      if (req.method === "GET") return serveStatic(req, res, pathname);
      send(res, 405, { error: "Method not allowed" });
    } catch (err) {
      const status = err.status || 500;
      if (status === 500) console.error(err);
      send(res, status, { error: status === 500 ? "Internal server error" : err.message });
    }
  });

  server.listen(PORT, () => console.log(`Tagged Notes running on port ${PORT} (db: ${store.kind})`));
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});

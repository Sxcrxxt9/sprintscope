import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  ApiError,
  createWorkItem,
  getAnalytics,
  listWorkItems,
  openDatabase,
  resetDatabase,
  updateWorkItemStatus,
} from "./db.js";

const port = Number(process.env.PORT ?? 8787);
const demoToken = process.env.SPRINTSCOPE_TOKEN ?? "sprintscope-pro-demo";
const db = await openDatabase();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    sendJson(response, status, { error: error.message || "Internal server error" });
  }
});

server.listen(port, () => {
  console.log(`SprintScope Pro API listening on http://localhost:${port}`);
});

async function handleApi(request, response, url) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/session") {
    sendJson(response, 200, {
      user: { name: "Demo Engineering Manager", role: "manager" },
      permissions: ["read:work", "write:work", "reset:demo", "export:release"],
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/work-items") {
    sendJson(response, 200, { items: listWorkItems(db) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/analytics") {
    sendJson(response, 200, { analytics: getAnalytics(db) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/export") {
    sendJson(response, 200, {
      exportedAt: new Date().toISOString(),
      items: listWorkItems(db),
      analytics: getAnalytics(db),
    });
    return;
  }

  requireAuth(request);

  if (request.method === "POST" && url.pathname === "/api/work-items") {
    const item = createWorkItem(db, await readJson(request));
    sendJson(response, 201, { item, analytics: getAnalytics(db) });
    return;
  }

  const statusMatch = url.pathname.match(/^\/api\/work-items\/([^/]+)\/status$/);
  if (request.method === "PATCH" && statusMatch) {
    const payload = await readJson(request);
    const row = updateWorkItemStatus(db, statusMatch[1], payload.status);
    sendJson(response, 200, { item: normalizeRow(row), analytics: getAnalytics(db) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reset") {
    sendJson(response, 200, { items: resetDatabase(db), analytics: getAnalytics(db) });
    return;
  }

  throw new ApiError(404, "Route not found");
}

function requireAuth(request) {
  if (request.headers.authorization !== `Bearer ${demoToken}`) {
    throw new ApiError(401, "Missing or invalid demo token");
  }
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "Malformed JSON");
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function serveStatic(response, pathname) {
  const filePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolvedPath = path.join(process.cwd(), "dist", filePath);
  const fallbackPath = path.join(process.cwd(), "dist", "index.html");

  try {
    const content = await readFile(resolvedPath);
    response.writeHead(200, { "Content-Type": contentType(resolvedPath) });
    response.end(content);
  } catch {
    try {
      const content = await readFile(fallbackPath);
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(content);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Build the frontend with `npm run build`, or use `npm run dev` for local development.");
    }
  }
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function normalizeRow(row) {
  return {
    id: row.id,
    title: row.title,
    team: row.team,
    owner: row.owner,
    status: row.status,
    severity: row.severity,
    estimate: row.estimate,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: JSON.parse(row.tags),
    notes: row.notes,
  };
}

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";

const dayMs = 86_400_000;
const statuses = new Set(["triage", "in-progress", "blocked", "ready"]);
const severities = new Set(["sev1", "sev2", "sev3", "sev4"]);
const severityWeight = {
  sev1: 38,
  sev2: 26,
  sev3: 14,
  sev4: 6,
};

function isoFromNow(days) {
  return new Date(Date.now() + days * dayMs).toISOString().slice(0, 10);
}

function seedItem(id, title, team, owner, status, severity, estimate, dueOffset, createdOffset, tags, notes) {
  return {
    id,
    title,
    team,
    owner,
    status,
    severity,
    estimate,
    dueDate: isoFromNow(dueOffset),
    createdAt: new Date(Date.now() + createdOffset * dayMs).toISOString(),
    updatedAt: new Date(Date.now() - dayMs).toISOString(),
    tags,
    notes,
  };
}

const seedItems = [
  seedItem(
    "wrk-101",
    "Checkout retry loop after expired payment token",
    "Payments",
    "Mina",
    "blocked",
    "sev1",
    8,
    1,
    -6,
    ["stripe", "checkout"],
    "Blocked on payment provider sandbox logs. Customer support has three matching reports.",
  ),
  seedItem(
    "wrk-102",
    "Invoice export drops tax IDs for EU accounts",
    "Billing",
    "Owen",
    "in-progress",
    "sev2",
    5,
    3,
    -4,
    ["csv", "compliance"],
    "Serializer patch is in review. Need regression coverage for mixed tax regions.",
  ),
  seedItem(
    "wrk-103",
    "Search ranking ignores archived knowledge-base pages",
    "Platform",
    "Nora",
    "triage",
    "sev3",
    3,
    5,
    -2,
    ["search", "indexing"],
    "Confirm whether archived pages should be searchable for admin users only.",
  ),
  seedItem(
    "wrk-104",
    "Mobile nav loses focus state after route transition",
    "Experience",
    "Jay",
    "ready",
    "sev4",
    2,
    2,
    -5,
    ["accessibility", "mobile"],
    "Verified with keyboard navigation and screen reader smoke test.",
  ),
  seedItem(
    "wrk-105",
    "Webhook retries are not capped for malformed payloads",
    "Platform",
    "Mina",
    "in-progress",
    "sev2",
    6,
    2,
    -8,
    ["webhooks", "queue"],
    "Add poison-message cap and expose retry count in the delivery log.",
  ),
  seedItem(
    "wrk-106",
    "Account switcher shows stale workspace plan",
    "Experience",
    "Iris",
    "triage",
    "sev3",
    4,
    7,
    -1,
    ["cache", "workspace"],
    "Likely cache invalidation issue after billing plan update.",
  ),
];

export async function openDatabase(dbPath = process.env.SPRINTSCOPE_DB) {
  const wasmPath = path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");
  const SQL = await initSqlJs({
    wasmBinary: readFileSync(wasmPath),
  });
  const resolvedPath = dbPath ?? path.join(process.cwd(), "data", "sprintscope.sqlite");
  mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const db = existsSync(resolvedPath)
    ? new SQL.Database(readFileSync(resolvedPath))
    : new SQL.Database();
  db.persistPath = resolvedPath;

  db.run(`
    CREATE TABLE IF NOT EXISTS work_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      team TEXT NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL,
      severity TEXT NOT NULL,
      estimate INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      tags TEXT NOT NULL,
      notes TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status);
    CREATE INDEX IF NOT EXISTS idx_work_items_team ON work_items(team);
    CREATE INDEX IF NOT EXISTS idx_work_items_owner ON work_items(owner);
  `);

  const count = getOne(db, "SELECT COUNT(*) AS count FROM work_items").count;
  if (count === 0) seedDatabase(db);
  persist(db);

  return db;
}

export function seedDatabase(db) {
  db.run("BEGIN");
  try {
    db.run("DELETE FROM work_items");
    const statement = db.prepare(`
      INSERT INTO work_items (
        id, title, team, owner, status, severity, estimate, due_date, created_at, updated_at, tags, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of seedItems) statement.run(toRowValues(item));
    statement.free();
    db.run("COMMIT");
    persist(db);
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}

export function listWorkItems(db) {
  return getAll(db, "SELECT * FROM work_items ORDER BY updated_at DESC").map(fromRow);
}

export function createWorkItem(db, input) {
  validateWorkItemInput(input);
  const now = new Date().toISOString();
  const item = {
    id: randomUUID(),
    title: input.title.trim(),
    team: input.team.trim(),
    owner: input.owner.trim(),
    status: "triage",
    severity: input.severity,
    estimate: Number(input.estimate),
    dueDate: input.dueDate,
    createdAt: now,
    updatedAt: now,
    tags: extractTags(input.notes),
    notes: input.notes.trim(),
  };

  const statement = db.prepare(`
    INSERT INTO work_items (
      id, title, team, owner, status, severity, estimate, due_date, created_at, updated_at, tags, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  statement.run(toRowValues(item));
  statement.free();
  persist(db);

  return item;
}

export function updateWorkItemStatus(db, id, status) {
  if (!statuses.has(status)) throw new ApiError(400, "Unsupported status");
  const updatedAt = new Date().toISOString();
  db.run("UPDATE work_items SET status = ?, updated_at = ? WHERE id = ?", [status, updatedAt, id]);

  const row = getOne(db, "SELECT * FROM work_items WHERE id = ?", [id]);
  if (!row) throw new ApiError(404, "Work item not found");
  persist(db);

  return row;
}

export function getAnalytics(db, todayIso = new Date().toISOString()) {
  const items = listWorkItems(db);
  const active = items.filter((item) => item.status !== "ready");
  const riskScores = items.map((item) => ({ item, score: riskScore(item, todayIso) }));
  const highRisk = riskScores.filter(({ item, score }) => item.status !== "ready" && riskLevel(score) === "high");
  const overdue = active.filter((item) => daysBetween(todayIso, item.dueDate) < 0);
  const byTeam = Object.values(
    active.reduce((teams, item) => {
      const current = teams[item.team] ?? { team: item.team, active: 0, highRisk: 0, estimate: 0 };
      const score = riskScore(item, todayIso);
      current.active += 1;
      current.highRisk += riskLevel(score) === "high" ? 1 : 0;
      current.estimate += item.estimate;
      teams[item.team] = current;
      return teams;
    }, {}),
  ).sort((left, right) => right.highRisk - left.highRisk || right.estimate - left.estimate);

  return {
    active: active.length,
    ready: items.length - active.length,
    highRisk: highRisk.length,
    overdue: overdue.length,
    totalEstimate: active.reduce((sum, item) => sum + item.estimate, 0),
    averageRisk:
      riskScores.length === 0
        ? 0
        : Math.round(riskScores.reduce((sum, { score }) => sum + score, 0) / riskScores.length),
    topRisks: riskScores
      .filter(({ item }) => item.status !== "ready")
      .sort((left, right) => right.score - left.score)
      .slice(0, 5)
      .map(({ item, score }) => ({ id: item.id, title: item.title, owner: item.owner, team: item.team, score })),
    byTeam,
  };
}

export function resetDatabase(db) {
  seedDatabase(db);
  return listWorkItems(db);
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function validateWorkItemInput(input) {
  if (!input || typeof input !== "object") throw new ApiError(400, "Invalid payload");
  if (!String(input.title ?? "").trim()) throw new ApiError(400, "Title is required");
  if (!String(input.team ?? "").trim()) throw new ApiError(400, "Team is required");
  if (!String(input.owner ?? "").trim()) throw new ApiError(400, "Owner is required");
  if (!severities.has(input.severity)) throw new ApiError(400, "Unsupported severity");
  if (!Number.isInteger(Number(input.estimate)) || Number(input.estimate) < 1 || Number(input.estimate) > 13) {
    throw new ApiError(400, "Estimate must be between 1 and 13");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.dueDate ?? ""))) throw new ApiError(400, "Due date is required");
}

function toRowValues(item) {
  return [
    item.id,
    item.title,
    item.team,
    item.owner,
    item.status,
    item.severity,
    item.estimate,
    item.dueDate,
    item.createdAt,
    item.updatedAt,
    JSON.stringify(item.tags),
    item.notes,
  ];
}

function getAll(db, sql, parameters = []) {
  const statement = db.prepare(sql);
  statement.bind(parameters);
  const rows = [];
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
}

function getOne(db, sql, parameters = []) {
  return getAll(db, sql, parameters)[0];
}

function fromRow(row) {
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

function extractTags(notes) {
  return String(notes ?? "")
    .split(/[,\n\s]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.startsWith("#") && tag.length > 1)
    .map((tag) => tag.replace(/^#/, "").replace(/[^\w-]/g, ""))
    .filter(Boolean);
}

function daysBetween(startIso, endIso) {
  const diff = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.ceil(diff / dayMs);
}

function riskScore(item, todayIso) {
  const daysLeft = daysBetween(todayIso, item.dueDate);
  const age = Math.max(0, daysBetween(item.createdAt, todayIso));
  const deadlinePressure = daysLeft < 0 ? 40 : Math.max(0, 24 - daysLeft * 4);
  const blockedPressure = item.status === "blocked" ? 24 : 0;
  const stalePressure = item.status !== "ready" ? Math.min(18, age * 2) : 0;
  const scopePressure = Math.min(12, item.estimate * 1.5);
  return Math.min(
    100,
    Math.round(severityWeight[item.severity] + deadlinePressure + blockedPressure + stalePressure + scopePressure),
  );
}

function riskLevel(score) {
  if (score >= 72) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function persist(db) {
  if (db.persistPath) writeFileSync(db.persistPath, Buffer.from(db.export()));
}

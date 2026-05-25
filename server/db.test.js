import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { createWorkItem, getAnalytics, listWorkItems, openDatabase, updateWorkItemStatus } from "./db.js";

async function testDatabase() {
  const dbPath = path.join(tmpdir(), `sprintscope-${crypto.randomUUID()}.sqlite`);
  const db = await openDatabase(dbPath);
  return {
    db,
    cleanup() {
      db.close();
      rmSync(dbPath, { force: true });
    },
  };
}

test("seeds a new SQLite database with release work", async () => {
  const { db, cleanup } = await testDatabase();

  try {
    const items = listWorkItems(db);
    assert.equal(items.length, 6);
    assert.equal(getAnalytics(db).active, 5);
  } finally {
    cleanup();
  }
});

test("creates and updates work through the persistence layer", async () => {
  const { db, cleanup } = await testDatabase();

  try {
    const item = createWorkItem(db, {
      title: "API smoke test task",
      team: "Platform",
      owner: "Beam",
      severity: "sev2",
      estimate: 3,
      dueDate: "2026-06-01",
      notes: "Persist via API #test",
    });
    const updated = updateWorkItemStatus(db, item.id, "in-progress");

    assert.equal(updated.status, "in-progress");
    assert.equal(listWorkItems(db).some((workItem) => workItem.id === item.id), true);
  } finally {
    cleanup();
  }
});

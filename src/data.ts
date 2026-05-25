import type { Severity, Status, WorkItem } from "./domain";

const dayMs = 86_400_000;

function isoFromNow(days: number): string {
  const date = new Date(Date.now() + days * dayMs);
  return date.toISOString().slice(0, 10);
}

function item(
  id: string,
  title: string,
  team: string,
  owner: string,
  status: Status,
  severity: Severity,
  estimate: number,
  dueOffset: number,
  createdOffset: number,
  tags: string[],
  notes: string,
): WorkItem {
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

export const seedItems: WorkItem[] = [
  item(
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
  item(
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
  item(
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
  item(
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
  item(
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
  item(
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

export type Status = "triage" | "in-progress" | "blocked" | "ready";
export type Severity = "sev1" | "sev2" | "sev3" | "sev4";

export type WorkItem = {
  id: string;
  title: string;
  team: string;
  owner: string;
  status: Status;
  severity: Severity;
  estimate: number;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  notes: string;
};

export type Filters = {
  query: string;
  team: string;
  owner: string;
  status: "all" | Status;
};

export const statusLabels: Record<Status, string> = {
  triage: "Triage",
  "in-progress": "In progress",
  blocked: "Blocked",
  ready: "Ready",
};

export const severityLabels: Record<Severity, string> = {
  sev1: "SEV-1",
  sev2: "SEV-2",
  sev3: "SEV-3",
  sev4: "SEV-4",
};

export const statuses = Object.keys(statusLabels) as Status[];
export const severities = Object.keys(severityLabels) as Severity[];

const severityWeight: Record<Severity, number> = {
  sev1: 38,
  sev2: 26,
  sev3: 14,
  sev4: 6,
};

export function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const diff = end.getTime() - start.getTime();
  return Math.ceil(diff / 86_400_000);
}

export function riskScore(item: WorkItem, todayIso = new Date().toISOString()): number {
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

export function riskLevel(score: number): "high" | "medium" | "low" {
  if (score >= 72) return "high";
  if (score >= 45) return "medium";
  return "low";
}

export function filterItems(items: WorkItem[], filters: Filters): WorkItem[] {
  const query = filters.query.trim().toLowerCase();

  return items.filter((item) => {
    const matchesText =
      query.length === 0 ||
      [item.title, item.owner, item.team, item.notes, ...item.tags].some((value) =>
        value.toLowerCase().includes(query),
      );
    const matchesTeam = filters.team === "all" || item.team === filters.team;
    const matchesOwner = filters.owner === "all" || item.owner === filters.owner;
    const matchesStatus = filters.status === "all" || item.status === filters.status;

    return matchesText && matchesTeam && matchesOwner && matchesStatus;
  });
}

export function summarize(items: WorkItem[], todayIso = new Date().toISOString()) {
  const activeItems = items.filter((item) => item.status !== "ready");
  const atRisk = activeItems.filter((item) => riskLevel(riskScore(item, todayIso)) === "high");
  const overdue = activeItems.filter((item) => daysBetween(todayIso, item.dueDate) < 0);
  const totalEstimate = activeItems.reduce((sum, item) => sum + item.estimate, 0);

  return {
    active: activeItems.length,
    atRisk: atRisk.length,
    overdue: overdue.length,
    ready: items.filter((item) => item.status === "ready").length,
    totalEstimate,
  };
}

export function buildStandupSummary(items: WorkItem[], todayIso = new Date().toISOString()): string {
  const summary = summarize(items, todayIso);
  const topRisks = [...items]
    .filter((item) => item.status !== "ready")
    .sort((left, right) => riskScore(right, todayIso) - riskScore(left, todayIso))
    .slice(0, 3)
    .map((item) => `- ${severityLabels[item.severity]} ${item.title} (${item.owner})`);

  return [
    `SprintScope standup: ${summary.active} active, ${summary.atRisk} high risk, ${summary.ready} ready.`,
    "Top risks:",
    topRisks.length > 0 ? topRisks.join("\n") : "- No active risk flagged",
  ].join("\n");
}

export function createWorkItem(input: Pick<WorkItem, "title" | "team" | "owner" | "severity" | "estimate" | "dueDate" | "notes">): WorkItem {
  const now = new Date().toISOString();

  return {
    ...input,
    id: crypto.randomUUID(),
    status: "triage",
    createdAt: now,
    updatedAt: now,
    tags: input.notes
      .split(/[,\n]/)
      .map((tag) => tag.trim())
      .filter((tag) => tag.startsWith("#"))
      .map((tag) => tag.replace(/^#/, "")),
  };
}

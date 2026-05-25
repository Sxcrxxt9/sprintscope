import { describe, expect, it } from "vitest";
import { buildStandupSummary, filterItems, riskLevel, riskScore, summarize, type WorkItem } from "./domain";

const baseItem: WorkItem = {
  id: "wrk-test",
  title: "Payment callback fails",
  team: "Payments",
  owner: "Mina",
  status: "blocked",
  severity: "sev1",
  estimate: 8,
  dueDate: "2026-05-26",
  createdAt: "2026-05-20T00:00:00.000Z",
  updatedAt: "2026-05-24T00:00:00.000Z",
  tags: ["payments", "webhook"],
  notes: "Retry cap missing",
};

describe("release risk scoring", () => {
  it("flags severe blocked work near the due date as high risk", () => {
    const score = riskScore(baseItem, "2026-05-25T00:00:00.000Z");

    expect(score).toBeGreaterThanOrEqual(72);
    expect(riskLevel(score)).toBe("high");
  });

  it("keeps ready low severity work out of active summary totals", () => {
    const readyItem: WorkItem = { ...baseItem, id: "ready", status: "ready", severity: "sev4", estimate: 2 };
    const summary = summarize([baseItem, readyItem], "2026-05-25T00:00:00.000Z");

    expect(summary.active).toBe(1);
    expect(summary.ready).toBe(1);
    expect(summary.totalEstimate).toBe(8);
  });
});

describe("work item filtering", () => {
  it("matches text against title, owner, team, notes, and tags", () => {
    const result = filterItems([baseItem], {
      query: "webhook",
      team: "all",
      owner: "all",
      status: "all",
    });

    expect(result).toHaveLength(1);
  });

  it("builds a concise standup summary with top risk ownership", () => {
    const summary = buildStandupSummary([baseItem], "2026-05-25T00:00:00.000Z");

    expect(summary).toContain("1 active");
    expect(summary).toContain("Payment callback fails");
    expect(summary).toContain("Mina");
  });
});

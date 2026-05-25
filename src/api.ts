import type { Severity, Status, WorkItem } from "./domain";

export type Analytics = {
  active: number;
  ready: number;
  highRisk: number;
  overdue: number;
  totalEstimate: number;
  averageRisk: number;
  topRisks: Array<{
    id: string;
    title: string;
    owner: string;
    team: string;
    score: number;
  }>;
  byTeam: Array<{
    team: string;
    active: number;
    highRisk: number;
    estimate: number;
  }>;
};

export type Session = {
  user: {
    name: string;
    role: string;
  };
  permissions: string[];
};

export type NewWorkItemInput = {
  title: string;
  team: string;
  owner: string;
  severity: Severity;
  estimate: number;
  dueDate: string;
  notes: string;
};

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";
const demoToken = import.meta.env.VITE_SPRINTSCOPE_TOKEN ?? "sprintscope-pro-demo";

export async function getSession(): Promise<Session> {
  return request<Session>("/session");
}

export async function getWorkItems(): Promise<WorkItem[]> {
  const response = await request<{ items: WorkItem[] }>("/work-items");
  return response.items;
}

export async function getAnalytics(): Promise<Analytics> {
  const response = await request<{ analytics: Analytics }>("/analytics");
  return response.analytics;
}

export async function createWorkItemApi(input: NewWorkItemInput): Promise<{ item: WorkItem; analytics: Analytics }> {
  return request("/work-items", {
    method: "POST",
    body: JSON.stringify(input),
    authenticated: true,
  });
}

export async function updateStatusApi(id: string, status: Status): Promise<{ item: WorkItem; analytics: Analytics }> {
  return request(`/work-items/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
    authenticated: true,
  });
}

export async function resetDemoApi(): Promise<{ items: WorkItem[]; analytics: Analytics }> {
  return request("/reset", {
    method: "POST",
    authenticated: true,
  });
}

export async function exportReleaseJson(): Promise<string> {
  const response = await request<unknown>("/export");
  return JSON.stringify(response, null, 2);
}

async function request<T>(path: string, options: RequestInit & { authenticated?: boolean } = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.authenticated ? { Authorization: `Bearer ${demoToken}` } : {}),
      ...options.headers,
    },
  });

  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "SprintScope API request failed");

  return payload;
}

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCopy,
  Database,
  Download,
  Filter,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  createWorkItemApi,
  exportReleaseJson,
  getAnalytics,
  getSession,
  getWorkItems,
  resetDemoApi,
  updateStatusApi,
  type Analytics,
  type Session,
} from "./api";
import {
  buildStandupSummary,
  filterItems,
  riskLevel,
  riskScore,
  severityLabels,
  severities,
  statusLabels,
  statuses,
  summarize,
  type Filters,
  type Severity,
  type Status,
  type WorkItem,
} from "./domain";

const defaultFilters: Filters = {
  query: "",
  team: "all",
  owner: "all",
  status: "all",
};

const defaultForm = {
  title: "",
  team: "Platform",
  owner: "",
  severity: "sev3" as Severity,
  estimate: 3,
  dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
  notes: "",
};

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(iso));
}

function App() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [form, setForm] = useState(defaultForm);
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadWorkspace() {
      try {
        const [sessionResponse, itemsResponse, analyticsResponse] = await Promise.all([
          getSession(),
          getWorkItems(),
          getAnalytics(),
        ]);
        setSession(sessionResponse);
        setItems(itemsResponse);
        setAnalytics(analyticsResponse);
        setSelectedId(itemsResponse[0]?.id ?? "");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not connect to SprintScope API");
      } finally {
        setIsLoading(false);
      }
    }

    void loadWorkspace();
  }, []);

  const filteredItems = useMemo(() => filterItems(items, filters), [items, filters]);
  const summary = useMemo(() => summarize(items), [items]);
  const teams = useMemo(() => unique(items.map((item) => item.team)), [items]);
  const owners = useMemo(() => unique(items.map((item) => item.owner)), [items]);
  const selectedItem = items.find((item) => item.id === selectedId) ?? filteredItems[0] ?? items[0];

  async function updateStatus(itemId: string, status: Status) {
    const previousItems = items;
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, status, updatedAt: new Date().toISOString() } : item)),
    );

    try {
      const response = await updateStatusApi(itemId, status);
      setItems((current) => current.map((item) => (item.id === itemId ? response.item : item)));
      setAnalytics(response.analytics);
    } catch (error) {
      setItems(previousItems);
      setNotice(error instanceof Error ? error.message : "Status update failed");
    }
  }

  async function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.owner.trim() || !form.team.trim()) return;

    try {
      const response = await createWorkItemApi({
        title: form.title.trim(),
        team: form.team.trim(),
        owner: form.owner.trim(),
        severity: form.severity,
        estimate: form.estimate,
        dueDate: form.dueDate,
        notes: form.notes.trim(),
      });

      setItems((current) => [response.item, ...current]);
      setAnalytics(response.analytics);
      setSelectedId(response.item.id);
      setForm(defaultForm);
      setNotice("Work item saved to SQLite");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Work item could not be saved");
    }
  }

  async function copySummary() {
    const text = buildStandupSummary(items);
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Standup summary copied");
    } catch {
      setNotice(text);
    }
  }

  async function exportRelease() {
    try {
      const text = await exportReleaseJson();
      await navigator.clipboard.writeText(text);
      setNotice("Release JSON copied");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Export failed");
    }
  }

  async function restoreDemoData() {
    try {
      const response = await resetDemoApi();
      setItems(response.items);
      setAnalytics(response.analytics);
      setSelectedId(response.items[0]?.id ?? "");
      setNotice("SQLite demo data restored");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Reset failed");
    }
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="SprintScope overview">
        <div>
          <p className="eyebrow">Full-stack release operations workspace</p>
          <h1>SprintScope Pro</h1>
        </div>
        <div className="topbar-actions">
          <div className="session-pill" aria-label="Signed in user">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>{session?.user.role ?? "loading"}</span>
          </div>
          <button className="ghost-button" type="button" onClick={restoreDemoData}>
            <RotateCcw size={17} aria-hidden="true" />
            Reset demo
          </button>
          <button className="ghost-button" type="button" onClick={exportRelease}>
            <Download size={17} aria-hidden="true" />
            Export JSON
          </button>
          <button className="primary-button" type="button" onClick={copySummary}>
            <ClipboardCopy size={17} aria-hidden="true" />
            Copy standup
          </button>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Release metrics">
        <Metric label="Active work" value={summary.active} helper={`${summary.totalEstimate} estimate points`} />
        <Metric label="High risk" value={analytics?.highRisk ?? summary.atRisk} helper="Backend risk engine" tone="danger" />
        <Metric label="Overdue" value={summary.overdue} helper="Past committed date" tone="warning" />
        <Metric label="Avg risk" value={analytics?.averageRisk ?? 0} helper="Calculated by API" tone="success" />
      </section>

      <section className="workspace">
        <aside className="control-panel" aria-label="Filters and new work item">
          <div className="api-status">
            <Database size={17} aria-hidden="true" />
            <div>
              <strong>{isLoading ? "Connecting" : "SQLite API online"}</strong>
              <span>{analytics?.topRisks.length ?? 0} tracked risk signals</span>
            </div>
          </div>

          <div className="panel-heading">
            <Filter size={18} aria-hidden="true" />
            <h2>Filters</h2>
          </div>

          <label className="field search-field">
            <span>Search</span>
            <Search size={16} aria-hidden="true" />
            <input
              value={filters.query}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })}
              placeholder="ticket, owner, tag"
            />
          </label>

          <label className="field">
            <span>Team</span>
            <select value={filters.team} onChange={(event) => setFilters({ ...filters, team: event.target.value })}>
              <option value="all">All teams</option>
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Owner</span>
            <select value={filters.owner} onChange={(event) => setFilters({ ...filters, owner: event.target.value })}>
              <option value="all">All owners</option>
              {owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value as Filters["status"] })}
            >
              <option value="all">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>

          <form className="new-item-form" onSubmit={addItem}>
            <div className="panel-heading">
              <Plus size={18} aria-hidden="true" />
              <h2>New work item</h2>
            </div>
            <label className="field">
              <span>Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Bug or release task"
              />
            </label>
            <div className="two-column">
              <label className="field">
                <span>Team</span>
                <input value={form.team} onChange={(event) => setForm({ ...form, team: event.target.value })} />
              </label>
              <label className="field">
                <span>Owner</span>
                <input
                  value={form.owner}
                  onChange={(event) => setForm({ ...form, owner: event.target.value })}
                  placeholder="Name"
                />
              </label>
            </div>
            <div className="two-column">
              <label className="field">
                <span>Severity</span>
                <select
                  value={form.severity}
                  onChange={(event) => setForm({ ...form, severity: event.target.value as Severity })}
                >
                  {severities.map((severity) => (
                    <option key={severity} value={severity}>
                      {severityLabels[severity]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Estimate</span>
                <input
                  type="number"
                  min="1"
                  max="13"
                  value={form.estimate}
                  onChange={(event) => setForm({ ...form, estimate: Number(event.target.value) })}
                />
              </label>
            </div>
            <label className="field">
              <span>Due date</span>
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Context, blockers, #tags"
              />
            </label>
            <button className="primary-button full-width" type="submit">
              <Plus size={17} aria-hidden="true" />
              Add item
            </button>
          </form>
        </aside>

        <section className="board-section" aria-label="Release board">
          <div className="section-title">
            <BarChart3 size={19} aria-hidden="true" />
            <h2>Work board</h2>
            <span>{filteredItems.length} shown</span>
          </div>
          <div className="board">
            {statuses.map((status) => (
              <div className="board-column" key={status}>
                <div className="column-header">
                  <h3>{statusLabels[status]}</h3>
                  <span>{filteredItems.filter((item) => item.status === status).length}</span>
                </div>
                <div className="column-list">
                  {filteredItems
                    .filter((item) => item.status === status)
                    .sort((left, right) => riskScore(right) - riskScore(left))
                    .map((item) => (
                      <WorkCard
                        key={item.id}
                        item={item}
                        isSelected={selectedItem?.id === item.id}
                        onSelect={() => setSelectedId(item.id)}
                        onStatusChange={updateStatus}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="detail-panel" aria-label="Selected work item">
          {selectedItem ? (
            <DetailPanel item={selectedItem} analytics={analytics} onStatusChange={updateStatus} />
          ) : (
            <EmptyDetail />
          )}
        </aside>
      </section>

      {notice ? (
        <div className="notice" role="status" onAnimationEnd={() => setNotice("")}>
          {notice}
        </div>
      ) : null}
    </main>
  );
}

function Metric({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: number;
  helper: string;
  tone?: "neutral" | "danger" | "warning" | "success";
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  );
}

function WorkCard({
  item,
  isSelected,
  onSelect,
  onStatusChange,
}: {
  item: WorkItem;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (itemId: string, status: Status) => void;
}) {
  const score = riskScore(item);
  const level = riskLevel(score);

  return (
    <article className={`work-card ${isSelected ? "selected" : ""}`} onClick={onSelect}>
      <div className="card-topline">
        <span className={`severity ${item.severity}`}>{severityLabels[item.severity]}</span>
        <span className={`risk-pill ${level}`}>{score}</span>
      </div>
      <h4>{item.title}</h4>
      <p>{item.notes}</p>
      <div className="card-meta">
        <span>{item.team}</span>
        <span>{item.owner}</span>
        <span>{formatDate(item.dueDate)}</span>
      </div>
      <select
        aria-label={`Move ${item.title}`}
        value={item.status}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onStatusChange(item.id, event.target.value as Status)}
      >
        {statuses.map((status) => (
          <option key={status} value={status}>
            {statusLabels[status]}
          </option>
        ))}
      </select>
    </article>
  );
}

function DetailPanel({
  item,
  analytics,
  onStatusChange,
}: {
  item: WorkItem;
  analytics: Analytics | null;
  onStatusChange: (itemId: string, status: Status) => void;
}) {
  const score = riskScore(item);
  const level = riskLevel(score);
  const teamAnalytics = analytics?.byTeam.find((team) => team.team === item.team);

  return (
    <div>
      <div className="detail-header">
        <span className={`risk-icon ${level}`}>
          {level === "high" ? <AlertTriangle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
        </span>
        <div>
          <p className="eyebrow">Selected item</p>
          <h2>{item.title}</h2>
        </div>
      </div>
      <dl className="detail-list">
        <div>
          <dt>Owner</dt>
          <dd>{item.owner}</dd>
        </div>
        <div>
          <dt>Team</dt>
          <dd>{item.team}</dd>
        </div>
        <div>
          <dt>Risk score</dt>
          <dd>{score}/100</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{formatDate(item.dueDate)}</dd>
        </div>
        <div>
          <dt>Estimate</dt>
          <dd>{item.estimate} pts</dd>
        </div>
        <div>
          <dt>Severity</dt>
          <dd>{severityLabels[item.severity]}</dd>
        </div>
        <div>
          <dt>Team risk</dt>
          <dd>{teamAnalytics?.highRisk ?? 0} high</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatDate(item.updatedAt)}</dd>
        </div>
      </dl>
      <label className="field">
        <span>Status</span>
        <select value={item.status} onChange={(event) => onStatusChange(item.id, event.target.value as Status)}>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
      </label>
      <div className="notes-block">
        <h3>Context</h3>
        <p>{item.notes}</p>
      </div>
      <div className="tag-row">
        {item.tags.map((tag) => (
          <span key={tag}>#{tag}</span>
        ))}
      </div>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="empty-state">
      <CheckCircle2 size={22} aria-hidden="true" />
      <h2>No work selected</h2>
      <p>Clear the filters or add a release item to review details here.</p>
    </div>
  );
}

export default App;

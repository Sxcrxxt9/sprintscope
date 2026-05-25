# SprintScope Pro

SprintScope Pro is a full-stack release readiness platform for engineering teams. It tracks work items across triage, development, blocked, and ready states, persists release data in SQLite, and calculates practical launch risk from severity, deadline pressure, stale work, blockers, and estimate size.

## Why this project belongs on a developer resume

- Built with React, TypeScript, Vite, a Node API server, SQLite persistence, and automated tests.
- Separates frontend workflow, API client code, persistence logic, and risk-scoring behavior.
- Includes demo auth, REST-style endpoints, analytics, export, responsive layout, keyboard-friendly controls, and realistic seeded data.
- Models a workflow that engineering teams actually use before releases: ownership, blockers, due dates, severity, standup summary, status movement, and team-level risk review.

## Features

- Full-stack work item CRUD flow backed by a SQLite database.
- Release metrics for active work, high risk items, overdue items, average risk, and team risk.
- Filter by search text, team, owner, and status.
- Kanban-style work board sorted by risk score inside each status.
- Add new work items with severity, estimate, due date, notes, and tags.
- Move items between statuses from the board or detail panel.
- Demo auth token for protected write/reset routes.
- Copy a concise standup summary to the clipboard.
- Export release JSON for reporting or handoff.
- Restore demo data when you want a clean sample workspace.

## Tech Stack

- React
- TypeScript
- Vite
- Vitest
- Node.js HTTP API
- Portable SQLite persistence with `sql.js`
- Node test runner for backend persistence tests
- Responsive CSS with accessible form controls

## Local Development

```bash
npm install
npm run dev
```

The development command starts both services:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8787`

Run quality checks:

```bash
npm run test
npm run build
```

Run the production server after building:

```bash
npm run build
npm run start
```

## API Routes

- `GET /api/session`
- `GET /api/work-items`
- `POST /api/work-items`
- `PATCH /api/work-items/:id/status`
- `GET /api/analytics`
- `GET /api/export`
- `POST /api/reset`

## Resume Entry

**Project Name:** SprintScope Pro

**Description:** Built a full-stack React, TypeScript, Node, and SQLite release readiness platform for engineering teams to track blockers, ownership, due dates, and SLA-style launch risk. Implemented protected REST-style API routes, SQLite persistence, reusable risk-scoring logic, analytics, responsive Kanban workflow, JSON export, clipboard standup summaries, and automated tests for frontend domain logic and backend persistence.

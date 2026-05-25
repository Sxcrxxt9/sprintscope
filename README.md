# SprintScope

SprintScope is a release readiness dashboard for small product teams. It tracks work items across triage, development, blocked, and ready states, then calculates a practical risk score from severity, deadline pressure, stale work, blockers, and estimate size.

## Why this project belongs on a developer resume

- Built with React, TypeScript, Vite, and Vitest.
- Separates domain logic from UI so risk scoring and filtering can be tested.
- Includes local persistence, responsive layout, keyboard-friendly controls, and realistic seeded data.
- Models a workflow that engineering teams actually use before releases: ownership, blockers, due dates, severity, standup summary, and status movement.

## Features

- Release metrics for active work, high risk items, overdue items, and ready items.
- Filter by search text, team, owner, and status.
- Kanban-style work board sorted by risk score inside each status.
- Add new work items with severity, estimate, due date, notes, and tags.
- Move items between statuses from the board or detail panel.
- Copy a concise standup summary to the clipboard.
- Restore demo data when you want a clean sample workspace.

## Tech Stack

- React
- TypeScript
- Vite
- Vitest
- CSS modules-style global stylesheet with responsive layout

## Local Development

```bash
npm install
npm run dev
```

Run quality checks:

```bash
npm run test
npm run build
```

## Resume Entry

**Project Name:** SprintScope

**Description:** Built a React and TypeScript release readiness dashboard that helps teams track blockers, ownership, due dates, and SLA-style risk before launch. Implemented reusable risk-scoring logic, local persistence, responsive Kanban workflow, filters, clipboard standup summaries, and Vitest coverage for core domain behavior.

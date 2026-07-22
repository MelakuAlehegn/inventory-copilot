# Frontend

Next.js app for the live demo: **Auth.js** (GitHub/Google OAuth) with per-user
saved scenarios, a **streaming chat** UI for the agent, and dashboards for
forecasts, inventory policy, and simulation results.

> The full Next.js app is scaffolded in Week 6 (`pnpm create next-app`). This folder
> currently holds the package manifest, task runner, and this doc so the structure
> and `make` targets are in place. Talks to the backend at `API_BASE_URL` over REST/SSE.

## Tasks
```bash
make install     # pnpm install
make dev         # next dev
make build       # next build
make lint        # next lint
make typecheck   # tsc --noEmit
make test        # unit tests
```

## Planned layout
```
app/            # Next.js app router (chat, dashboards, auth routes)
components/     # UI components (chat stream, charts, scenario panels)
lib/            # API client, auth helpers, SSE handling
```

# Frontend

Next.js app for the live demo: **Auth.js** (GitHub/Google OAuth) with per-user
saved scenarios, a **streaming chat** UI for the agent, and dashboards for
forecasts, inventory policy, and simulation results.

Initialized with `pnpm create next-app`. Talks to the backend at `API_BASE_URL`
over REST/SSE.

## Tasks
```bash
make install     # pnpm install
make dev         # next dev
make build       # next build
make lint        # next lint
make typecheck   # tsc --noEmit
make test        # unit tests
```

## Layout
```
app/            # Next.js app router (chat, dashboards, auth routes)
components/     # UI components (chat stream, charts, scenario panels)
lib/            # API client, auth helpers, SSE handling
```

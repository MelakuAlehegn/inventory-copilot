# Fly.io deployment

Three Fly apps + one managed database:

- **api** (`api.fly.toml`) — FastAPI backend. Points the LLM provider abstraction at
  Groq (Llama-3.3-70B) in prod.
- **web** (`web.fly.toml`) — Next.js frontend (Auth.js OAuth).
- **cron machine** — advances "simulated today" and runs the daily batch.
- **Neon Postgres** — serverless DB (not on Fly); set `DATABASE_URL` as a Fly secret.

## Secrets (set per app with `fly secrets set`)
`GROQ_API_KEY`, `DATABASE_URL`, `LANGFUSE_*`, `LOGFIRE_TOKEN`, `NEXTAUTH_SECRET`,
`GITHUB_ID/SECRET`, `GOOGLE_ID/SECRET`.

## Deploy
```bash
make deploy          # from repo root -> infra deploy-api + deploy-web
```

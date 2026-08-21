# Retail Demand & Inventory Copilot

An end-to-end system for retail demand and inventory decisions. It learns to predict how much
each product will sell, turns those predictions into concrete stocking decisions, tests them
against real history, and puts a grounded AI assistant on top that answers questions and
explains every decision in plain language.

It runs on real Walmart sales data (the public M5 dataset): roughly 14,000 product-and-store
combinations across more than 21 million daily sales records. Four layers work together:

- **Machine learning.** A LightGBM model predicts a full *range* of likely demand for each
  product each day, not a single number, so plans can cover both a normal day and a busy one.
  It is properly backtested (scored on periods it never trained on) and beats the standard
  seasonal baseline by about 20%.
- **Inventory decisions + simulation.** Those forecasts become a concrete restocking rule
  (when to reorder, how much buffer to hold), which is then replayed against real historical
  demand to measure what it would actually have cost and how often shelves would have gone empty.
- **Data + analytics.** All 21 million-plus records are queried directly, so any breakdown by
  store, product, date, price, or promotion comes back fast, and the same data feeds both the
  forecasts and the dashboards.
- **A grounded AI assistant.** Not a chatbot bolted on the side: it can actually run the tools
  above (forecast a product, simulate a what-if, compare restocking rules, or query the sales
  history in SQL) and reason over the results. And a separate checker verifies every number it
  reports was genuinely produced by one of those tools. It cannot show you a figure it made up.

> **The core idea:** the math and the AI are kept separate. A plain, fully tested calculation
> core does every computation; the AI layer can only call that core and repeat what it returns.
> That separation is what makes the assistant both conversational and trustworthy: it explains
> decisions, it cannot invent them.

## Terms in one line

A few words show up throughout. Here is what they mean, in plain English:

- **Demand forecast** - our best guess of how many units each product will sell each day.
- **Fill rate** - the share of customer demand you can actually serve from stock. Higher is better.
- **Stockout** - running out of an item. The **stockout cost** is the money lost when a
  customer wants something you do not have.
- **Safety stock** - a little extra kept on hand so normal ups and downs do not cause a stockout.
- **Base-stock policy** - our restocking rule, driven by the forecast. We measure it against a
  **naive** rule (just reorder up to recent average sales) to prove it is actually better.

## Results

Measured on real Walmart sales data (the public M5 dataset, food items, all stores), on a
held-out period the model never saw during training:

| What we measured | Result |
|---|---|
| How accurate the demand forecast is, vs a simple "same as recent seasons" guess | **19.6% more accurate** (score: WRMSSE 0.89 vs 1.11; lower is better) |
| Share of demand served from stock (**fill rate**) | **93.2%**, vs 92.3% for the simple rule |
| Money lost to running out of stock (**stockout cost**) | **down 12.4%** (units short down 11.2%) |
| Total inventory cost (holding + stockouts + ordering) | **down 1.4%** |
| Does the assistant ever show a number it cannot back with a real calculation? | **No.** Every figure is checked by code before you see it. |

So the smart rule serves slightly more customers *and* loses noticeably less money to empty
shelves, at a lower total cost than the simple rule.

## How it fits together

```
                 Browser
                    |
                    v
        Next.js frontend  (sign-in, dashboards, live chat)
                    |  HTTP
                    v
             FastAPI backend
              /            \
             v              v
   Calculation core     AI assistant  (LangGraph + Gemini)
   - demand forecast    - can only call the core as tools
     (LightGBM)         - a code "referee" checks every number
   - restock policy       it wants to say; unverified numbers
     + simulation         are blocked, not shown
   - SQL analytics
     over the data
             |              |
             v              v
     Baked data files   Postgres  (users, saved chats, scenarios)
     (Parquet)
```

- **The math is separate from the AI.** The core is ordinary, tested code. The assistant is a
  thin layer that calls it. That is what makes the "never invents a number" guarantee possible.
- **The referee is plain code, not another AI.** It reads the assistant's draft answer and, for
  every number in it, confirms a tool actually produced that number. If not, the answer is
  blocked. You cannot talk a piece of code into approving a made-up figure.
- **Heavy results are computed once and reused,** so pages load fast instead of re-running
  simulations on every request.

## How it works

- **Forecast.** A LightGBM model predicts a *range* of demand per product per day (not just one
  number), so we can plan for a normal day and a busy day. Scored with WRMSSE, the M5
  competition's official accuracy measure.
- **Stock decision + simulation.** From the forecast we compute a restock rule (reorder point,
  safety stock, order-up-to level), then replay real historical demand day by day to see how it
  would have performed: fill rate, stockouts, and cost.
- **The assistant.** A hand-built LangGraph agent (using Google's Gemini) answers questions by
  calling the core's tools: run a what-if, compare rules, sweep the service-vs-cost trade-off,
  look up one product, or run read-only SQL over the sales history. The referee checks its
  numbers before you see them.

## Run it locally

You need the processed data present first (a one-time download + build):

```bash
make setup          # install backend and frontend dependencies
make data           # download the M5 food-sales slice and build it into Parquet
make train          # train the forecast model (writes the cached forecast)
```

Then run the whole stack (frontend + backend + database) with Docker:

```bash
cp .env.example .env    # fill in GOOGLE_API_KEY, AUTH_JWT_SECRET, AUTH_SECRET, Google OAuth
docker compose -f docker-compose.app.yml up --build

# one time, create the database tables:
DATABASE_MIGRATION_URL=postgresql+psycopg://copilot:copilot@localhost:5432/copilot make db-upgrade
```

Open http://localhost:3000. For day-to-day development without Docker, `make dev` runs the API
and web app together with live reload.

Reproduce the results table any time (no AI needed, just the math):

```bash
make eval           # prints the forecast + decision scorecard
```

## Quality

- **Every change is checked automatically** (GitHub Actions): code style (ruff), strict type
  checks (mypy), and tests on the backend; lint and type checks on the frontend.
- **A three-layer scorecard** grades the forecast, the stock decisions, and the assistant
  (`make eval`), so "is it actually good?" has a repeatable answer.

## Repository layout

```
inventory-copilot/
├── backend/               # Python: calculation core, AI agent, API, evaluation
├── frontend/              # Next.js app: auth, dashboards, streaming chat
├── data/                  # data lifecycle (raw + processed are gitignored)
├── docker-compose.app.yml # run the full stack (frontend + backend + Postgres)
├── docker-compose.yml     # local dependencies only (Postgres, etc.)
└── Makefile               # task runner - `make help`
```

## Built with

Python, FastAPI, LangGraph, Google Gemini, Polars, DuckDB, LightGBM, MLflow, Langfuse
(assistant tracing) on the backend; Next.js, React, Auth.js, Tailwind on the frontend;
Postgres for app state. Packaged with Docker.

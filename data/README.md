# Data

This project uses the **M5 Forecasting** dataset (Walmart daily unit sales),
a public Kaggle competition dataset. **No proprietary data is used.**

## Layout
```
data/
├── raw/         # original M5 CSVs (gitignored — download with `make data-download`)
├── interim/     # intermediate cleaned tables (gitignored)
└── processed/   # partitioned Parquet + features, ready for modeling (gitignored)
```

Everything under `raw/`, `interim/`, and `processed/` is **gitignored** — the data is
reproducible from the download + build steps, so it never lives in git.

## Getting the data
```bash
make data           # download + build
# or individually:
make data-download  # fetch raw M5 CSVs into data/raw/
make data-build     # transform -> partitioned Parquet + features in data/processed/
```

## Scope
v1 operates on the **FOODS** category across all **10 stores** (chosen for the least
intermittent demand → cleaner forecasts and a more legible inventory story).

## Files (M5)
- `sales_train_evaluation.csv` — daily unit sales per item/store.
- `calendar.csv` — dates, weekday, events, SNAP flags.
- `sell_prices.csv` — weekly item/store prices (used for price/promo features).

## Inventory economics (synthesized)
Lead time, review period, holding cost, order cost, and service level are **not** in
M5 — they are documented, user-adjustable parameters. Defaults and rationale live in
`backend/src/copilot/core/policy/`.

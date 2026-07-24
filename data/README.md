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

## Source & format
Downloaded via Nixtla's `datasetsforecast` M5 loader (no Kaggle auth). It caches the
original CSVs under `data/raw/m5/datasets/` and returns three tidy long-format frames:

- **Y_df** — targets: `unique_id, ds, y` (daily unit sales per item-store series).
- **X_df** — exogenous, same rows as Y_df: `unique_id, ds, event_name_1,
  event_type_1, event_name_2, event_type_2, snap_CA, snap_TX, snap_WI, sell_price`.
- **S_df** — static, one row per series (30,490): `unique_id, item_id, dept_id,
  cat_id, store_id, state_id`. The FOODS×10 slice filters `cat_id == "FOODS"`.

`unique_id` = `item_id` + `store_id`. The loader trims each series' leading zeros
(the pre-launch period before an item's first sale), so the full set is ~47.6M rows
rather than 30,490 × 1,941 days.

Original CSVs also present under `data/raw/m5/datasets/`:
- `sales_train_evaluation.csv` — daily unit sales per item/store (wide format).
- `calendar.csv` — dates, weekday, events, SNAP flags.
- `sell_prices.csv` — weekly item/store prices.

## Inventory economics (synthesized)
Lead time, review period, holding cost, order cost, and service level are **not** in
M5 — they are documented, user-adjustable parameters. Defaults and rationale live in
`backend/src/copilot/core/policy/`.

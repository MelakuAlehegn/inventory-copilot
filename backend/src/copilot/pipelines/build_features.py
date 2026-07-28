"""Materialize the modeling frame to partitioned Parquet + a manifest.

Writes the cleaned, feature-enriched FOODS frame to
``data/processed/features/store_id=<store>/part.parquet`` (Hive layout), processing
one store at a time to keep memory bounded. ``store_id`` is encoded in the path, so
it is dropped from the file columns and reconstructed on read via hive partitioning.

Also writes ``data/processed/features_manifest.json`` with row counts, date range,
columns, and a fingerprint hash so a build is reproducible and verifiable.

Run with::

    make data-build
    python -m copilot.pipelines.build_features
"""

from __future__ import annotations

import hashlib
import json

import polars as pl

from copilot.config import settings
from copilot.core.data.features import make_modeling_frame
from copilot.core.data.load import DATASETS

CATEGORY = "FOODS"


def list_stores(category: str) -> list[str]:
    """Distinct store_ids for a category (cheap: reads one column, no unpivot)."""
    return sorted(
        pl.scan_csv(DATASETS / "sales_train_evaluation.csv")
        .filter(pl.col("cat_id") == category)
        .select("store_id")
        .unique()
        .collect()
        .get_column("store_id")
        .to_list()
    )


def main() -> None:
    out_dir = settings.processed_dir / "features"
    out_dir.mkdir(parents=True, exist_ok=True)

    stores = list_stores(CATEGORY)
    rows_per_store: dict[str, int] = {}
    date_min: str | None = None
    date_max: str | None = None

    for store in stores:
        df = make_modeling_frame(CATEGORY, stores=[store]).collect()
        part = out_dir / f"store_id={store}"
        part.mkdir(parents=True, exist_ok=True)
        df.drop("store_id").write_parquet(part / "part.parquet")

        rows_per_store[store] = df.height
        lo, hi = str(df["ds"].min()), str(df["ds"].max())
        date_min = lo if date_min is None else min(date_min, lo)
        date_max = hi if date_max is None else max(date_max, hi)
        print(f"  {store}: {df.height:,} rows")

    manifest = {
        "category": CATEGORY,
        "stores": stores,
        "rows_total": sum(rows_per_store.values()),
        "rows_per_store": rows_per_store,
        "date_min": date_min,
        "date_max": date_max,
        "columns": make_modeling_frame(CATEGORY).collect_schema().names(),
    }
    manifest["fingerprint"] = hashlib.sha256(
        json.dumps(manifest, sort_keys=True).encode()
    ).hexdigest()[:16]

    (settings.processed_dir / "features_manifest.json").write_text(json.dumps(manifest, indent=2))
    print(
        f"Wrote {manifest['rows_total']:,} rows across {len(stores)} stores "
        f"-> {out_dir}  (fingerprint {manifest['fingerprint']})"
    )


if __name__ == "__main__":
    main()

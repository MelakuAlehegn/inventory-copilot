"""Download the raw M5 dataset into ``data/raw``.

Primary source: Nixtla's ``datasetsforecast`` M5 loader, which fetches M5 from a
public mirror with **no Kaggle account required** — so ``make data-download`` is
reproducible for anyone who clones the repo.

The loader caches under ``data/raw/m5/`` and is idempotent: re-running reuses the
cache instead of re-downloading.

Alternative (not used): the original CSVs from the Kaggle competition
``m5-forecasting-accuracy`` (requires a Kaggle account + accepting the rules).

Run with::

    make data-download        # from repo root
    python -m copilot.pipelines.download
"""

from __future__ import annotations

from copilot.config import settings


def main() -> None:
    # Imported lazily so the module import stays cheap and errors are actionable.
    from datasetsforecast.m5 import M5

    raw_dir = settings.raw_dir
    raw_dir.mkdir(parents=True, exist_ok=True)

    print(f"Downloading M5 into {raw_dir} (cached; safe to re-run)...")
    Y_df, X_df, S_df = M5.load(directory=str(raw_dir))

    print("M5 ready:")
    print(f"  targets   Y_df: {Y_df.shape[0]:,} rows, cols={list(Y_df.columns)}")
    print(f"  exogenous X_df: {X_df.shape[0]:,} rows, cols={list(X_df.columns)}")
    print(f"  static    S_df: {S_df.shape[0]:,} rows, cols={list(S_df.columns)}")


if __name__ == "__main__":
    main()

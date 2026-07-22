"""M5 ingestion and feature engineering.

Loads raw M5 CSVs, restricts to the FOODS x 10-store slice, and builds
partitioned Parquet with calendar/event/SNAP + price + lag/rolling features
using Polars and DuckDB. Deterministic and content-hashed for reproducibility.
"""

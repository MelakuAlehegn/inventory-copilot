"""Train the LightGBM quantile forecaster, cache its forecast, and log the run to MLflow.

Fits the global quantile model on the training split (everything up to the holdout
cutoff — no leakage) and writes the per-series quantile forecast for the horizon to
``data/processed/forecast_quantiles.parquet``. That artifact is what the policy,
simulation, and eval layers read, so training is one reproducible command.

Each run is recorded in MLflow: the model/feature parameters, the holdout accuracy
(WRMSSE, pinball, improvement over seasonal-naive), and the forecast artifact — an
auditable record of which settings produced which accuracy.

Run with::

    make train
    python -m copilot.pipelines.train
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import mlflow
import polars as pl

from copilot.config import settings
from copilot.core.data.load import read_features
from copilot.core.forecast.baseline import split_by_horizon
from copilot.core.forecast.model import model_params, train_and_forecast_quantiles
from copilot.eval.forecast import evaluate_forecast

_EXPERIMENT = "forecast"


def _features_fingerprint() -> str | None:
    """Provenance: the fingerprint recorded by the feature build, if present."""
    manifest = settings.processed_dir / "features_manifest.json"
    if manifest.exists():
        return json.loads(manifest.read_text()).get("fingerprint")
    return None


def log_training_run(
    metrics: dict[str, float], cutoff: date, n_series: int, artifact_path: Path
) -> str:
    """Record one training run (params, holdout metrics, forecast artifact) in MLflow."""
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    mlflow.set_experiment(_EXPERIMENT)
    with mlflow.start_run() as run:
        mlflow.log_params(
            {
                **model_params(),
                "cutoff": str(cutoff),
                "n_series": n_series,
                "features_fingerprint": _features_fingerprint(),
            }
        )
        mlflow.log_metrics(
            {
                "wrmsse": metrics["wrmsse_model"],
                "wrmsse_naive": metrics["wrmsse_naive"],
                "wrmsse_improvement": metrics["wrmsse_improvement"],
                "mean_rmsse": metrics["mean_rmsse_model"],
                "pinball": metrics["pinball_mean"],
            }
        )
        mlflow.log_artifact(str(artifact_path))
        return run.info.run_id


def main() -> None:
    features = read_features()
    train, test, cutoff = split_by_horizon(features)
    n_series = train.select(pl.col("unique_id").n_unique()).collect().item()
    print(f"training quantile forecaster on {n_series:,} series (cutoff {cutoff})...")

    forecast = train_and_forecast_quantiles(train).collect()
    out_path = settings.processed_dir / "forecast_quantiles.parquet"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    forecast.write_parquet(out_path)

    metrics = evaluate_forecast(train, forecast.lazy(), test.select("unique_id", "ds", "y"), cutoff)
    run_id = log_training_run(metrics, cutoff, n_series, out_path)

    print(f"wrote {forecast.height:,} rows -> {out_path}")
    print(
        f"WRMSSE {metrics['wrmsse_model']:.4f} "
        f"({metrics['wrmsse_improvement']:+.1%} vs naive), pinball {metrics['pinball_mean']:.4f}"
    )
    print(f"logged MLflow run {run_id} (experiment {_EXPERIMENT}, tracking {settings.mlflow_tracking_uri})")


if __name__ == "__main__":
    main()

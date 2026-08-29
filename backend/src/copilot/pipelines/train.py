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
import shutil
from datetime import date
from pathlib import Path

import mlflow
import polars as pl
from mlflow.pyfunc import PythonModel, PythonModelContext

from copilot.config import settings
from copilot.core.data.load import read_features
from copilot.core.forecast.baseline import split_by_horizon
from copilot.core.forecast.model import (
    fit_quantile_forecaster,
    model_params,
    quantile_forecast,
    save_forecaster,
)
from copilot.eval.forecast import evaluate_forecast

_EXPERIMENT = "forecast"
_REGISTERED_MODEL = "quantile_forecaster"


class _QuantileForecasterModel(PythonModel):
    """Pyfunc wrapper so the fitted forecaster is a registrable MLflow model.

    Reloads the saved MLForecast and returns the horizon forecast; `model_input` may carry a
    `horizon` column, otherwise the default horizon is used.
    """

    def load_context(self, context: PythonModelContext) -> None:
        from copilot.core.forecast.model import load_forecaster

        self._fcst = load_forecaster(context.artifacts["model_dir"])

    def predict(self, context: object, model_input: object, params: object = None) -> object:
        from copilot.core.forecast.baseline import HORIZON
        from copilot.core.forecast.model import quantile_forecast

        horizon = HORIZON
        cols = getattr(model_input, "columns", [])
        if model_input is not None and "horizon" in cols:
            horizon = int(model_input["horizon"].iloc[0])
        return quantile_forecast(self._fcst, horizon=horizon).collect().to_pandas()


def _features_fingerprint() -> str | None:
    """Provenance: the fingerprint recorded by the feature build, if present."""
    manifest = settings.processed_dir / "features_manifest.json"
    if manifest.exists():
        return json.loads(manifest.read_text()).get("fingerprint")
    return None


def log_training_run(
    metrics: dict[str, float], cutoff: date, n_series: int, artifact_path: Path, model_dir: Path
) -> str:
    """Record one training run (params, holdout metrics, forecast + fitted model) in MLflow."""
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
        # Log the fitted models as a registered MLflow model, so a run can be reloaded and
        # served without retraining, and each run shows up as a version in the Model Registry.
        mlflow.pyfunc.log_model(
            artifact_path="model",
            python_model=_QuantileForecasterModel(),
            artifacts={"model_dir": str(model_dir)},
            registered_model_name=_REGISTERED_MODEL,
            pip_requirements=["mlforecast", "lightgbm", "polars", "pandas"],
        )
        return run.info.run_id


def main() -> None:
    features = read_features()
    train, test, cutoff = split_by_horizon(features)
    n_series = train.select(pl.col("unique_id").n_unique()).collect().item()
    print(f"training quantile forecaster on {n_series:,} series (cutoff {cutoff})...")

    fcst = fit_quantile_forecaster(train)
    forecast = quantile_forecast(fcst).collect()
    out_path = settings.processed_dir / "forecast_quantiles.parquet"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    forecast.write_parquet(out_path)

    # Persist the fitted models to a stable path so they can be reloaded and served (no retrain).
    model_dir = settings.processed_dir / "quantile_model"
    if model_dir.exists():
        shutil.rmtree(model_dir)
    save_forecaster(fcst, model_dir)

    metrics = evaluate_forecast(train, forecast.lazy(), test.select("unique_id", "ds", "y"), cutoff)
    run_id = log_training_run(metrics, cutoff, n_series, out_path, model_dir)

    print(f"wrote {forecast.height:,} rows -> {out_path}")
    print(f"saved fitted quantile model -> {model_dir}")
    print(
        f"WRMSSE {metrics['wrmsse_model']:.4f} "
        f"({metrics['wrmsse_improvement']:+.1%} vs naive), pinball {metrics['pinball_mean']:.4f}"
    )
    print(
        f"logged MLflow run {run_id} (experiment {_EXPERIMENT}, "
        f"tracking {settings.mlflow_tracking_uri})"
    )


if __name__ == "__main__":
    main()

"""Probabilistic demand forecasting.

Global LightGBM model via mlforecast trained with quantile loss to produce a
demand distribution (multiple quantiles), post-sorted to prevent crossing.
Exposes a deterministic `forecast_demand(...)` function that the agent's tool
layer wraps. Backtested rolling-origin; tracked in MLflow.
"""

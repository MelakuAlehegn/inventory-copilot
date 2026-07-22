"""CLI entrypoints for the fixed-sequence pipeline (plain code, not agentic).

Modules: `download` (fetch raw M5), `build_features` (raw -> Parquet + features),
`train` (fit the quantile forecaster), and the simulated daily batch that advances
"today" and records the day's forecast/policy/order decision. Invoked via the Makefiles.
"""

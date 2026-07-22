"""Evaluation harness (three layers).

- forecast: rolling-origin backtest vs seasonal-naive (WRMSSE + pinball loss).
- decision: simulation vs naive baseline (total-cost reduction, stockout-days at
  equal service, Pareto frontier).
- agent: gold-labeled question set for tool-selection accuracy and faithfulness
  (programmatic numeric-grounding pass rate + LLM-judge reasoning score).

Running this module produces the metrics table that populates the README.
"""

"""Plots for the decision-quality story (matplotlib, static images for docs/README)."""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import polars as pl  # noqa: E402

# Validated categorical palette (dataviz skill, light mode; CVD ΔE 24.7 > 8).
_COLORS = {"base_stock": "#2a78d6", "naive": "#eb6834"}
_LABELS = {"base_stock": "Base-stock (forecast)", "naive": "Naive (history)"}


def plot_service_cost_curve(curve: pl.DataFrame, out_path: str | Path) -> Path:
    """Connected-scatter Pareto: fill rate (x) vs holding+stockout cost (y).

    Best is lower-right (more service, less cost). One point per service-level target,
    labelled; two policies, direct-labelled and in the legend so identity is never
    color-alone.
    """
    df = curve.with_columns((pl.col("holding_cost") + pl.col("stockout_cost")).alias("inv_cost"))

    fig, ax = plt.subplots(figsize=(8, 5.5), dpi=150)
    for policy in ("naive", "base_stock"):
        d = df.filter(pl.col("policy") == policy).sort("service_level")
        x = d["fill_rate"].to_list()
        y = (d["inv_cost"] / 1000).to_list()  # $k
        color = _COLORS[policy]
        ax.plot(x, y, "-o", color=color, linewidth=2, markersize=8, label=_LABELS[policy], zorder=3)
        for xi, yi, sl in zip(x, y, d["service_level"].to_list(), strict=True):
            ax.annotate(
                f"{sl:.0%}",
                (xi, yi),
                textcoords="offset points",
                xytext=(6, 6),
                fontsize=8,
                color="#52514e",
            )
        # direct label at the last point
        ax.annotate(
            _LABELS[policy],
            (x[-1], y[-1]),
            textcoords="offset points",
            xytext=(10, -2),
            fontsize=9,
            color=color,
            fontweight="bold",
            va="center",
        )

    ax.set_xlabel("Fill rate  (service achieved) →")
    ax.set_ylabel("Inventory cost  (holding + stockout), $k")
    ax.set_title(
        "Service vs cost: forecast-driven policy vs naive\n"
        "point labels = target service level · lower-right is better",
        fontsize=11,
    )
    ax.grid(True, color="#e6e6e3", linewidth=0.8, zorder=0)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    ax.margins(x=0.12, y=0.12)
    ax.legend(loc="upper right", frameon=False, fontsize=9)

    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(out, bbox_inches="tight")
    plt.close(fig)
    return out

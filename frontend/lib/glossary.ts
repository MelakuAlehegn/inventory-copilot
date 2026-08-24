// Plain-English definitions for the domain terms shown in the UI. One source of truth so the
// same wording explains a term everywhere it appears (via <TermLabel> / <InfoTip>).

export interface GlossaryEntry {
  /** The user-facing label for the term. */
  label: string;
  /** A one-line, non-expert explanation shown on hover. */
  tip: string;
}

export const GLOSSARY = {
  service_level: {
    label: "Service level",
    tip: "How often you aim to have enough stock to meet demand (for example, 95%).",
  },
  fill_rate: {
    label: "Fill rate",
    tip: "The share of customer demand you can serve from the stock on hand. Higher is better.",
  },
  stockout: {
    label: "Stockout",
    tip: "Running out of an item, so you miss sales.",
  },
  stockout_units: {
    label: "Units out of stock",
    tip: "How many units of demand you could not meet because stock ran out.",
  },
  stockout_day_rate: {
    label: "% of days out of stock",
    tip: "The share of days an item spent out of stock.",
  },
  safety_stock: {
    label: "Safety stock",
    tip: "Extra buffer stock kept so normal ups and downs in demand don't cause a stockout.",
  },
  reorder_level: {
    label: "Reorder level",
    tip: "When stock drops to this level, it's time to place a new order.",
  },
  target_max: {
    label: "Target max",
    tip: "The stock level you top back up to when you reorder.",
  },
  suggested_order: {
    label: "Suggested order",
    tip: "How many units to order now to reach the target max.",
  },
  avg_stock_held: {
    label: "Avg stock held",
    tip: "The average number of units sitting on the shelf over the period.",
  },
  days_of_stock: {
    label: "Days of stock left",
    tip: "How many days the current stock will last at the recent sales rate.",
  },
  lead_time: {
    label: "Lead time",
    tip: "Days between placing an order and receiving it.",
  },
  review_period: {
    label: "Review period",
    tip: "How often stock is checked and reordered.",
  },
  storage_cost: {
    label: "Storage cost",
    tip: "The cost of holding stock (space, capital, spoilage).",
  },
  lost_sales_cost: {
    label: "Lost-sales cost",
    tip: "The value of sales missed when an item is out of stock.",
  },
  base_stock: {
    label: "Base-stock",
    tip: "The app's forecast-driven method: reorder up to a target level set from the demand forecast.",
  },
  naive: {
    label: "Naive",
    tip: "A simple baseline to compare against: just reorder based on recent average sales.",
  },
  trade_off_curve: {
    label: "Trade-off curve",
    tip: "Shows the best balance between service (not running out) and cost across settings.",
  },
  product_line: {
    label: "Product line",
    tip: "One product in one store. The app plans each product-store line separately.",
  },
  elasticity: {
    label: "Elasticity",
    tip: "How much sales change when the price changes. 0 means price has no effect on demand.",
  },
  demand_change: {
    label: "Demand change",
    tip: "A dial for demand running higher or lower than the forecast expected.",
  },
  forecast_accuracy: {
    label: "Forecast accuracy",
    tip: "How close the demand forecast is to what actually sold. Measured with WRMSSE (lower error is better).",
  },
  pinball_loss: {
    label: "Pinball loss",
    tip: "A score for how well the forecast's range of outcomes matched reality. Lower is better.",
  },
  forecast_range: {
    label: "Forecast range",
    tip: "The forecast gives a range of likely demand, not one number, so you can plan for a normal or a busy day.",
  },
  quantile_fan: {
    label: "Quantile fan",
    tip: "The shaded bands show the range of likely demand, from the middle estimate outward to safer, higher-stock levels.",
  },
  seasonal_naive: {
    label: "Seasonal-naive",
    tip: "A simple forecast that just repeats a recent season. We compare our model against it to prove it's better.",
  },
  wrmsse: {
    label: "WRMSSE",
    tip: "The forecast's error score (the M5 competition's standard measure). Lower is better.",
  },
  improvement: {
    label: "Improvement",
    tip: "How much more accurate our forecast is than the simple seasonal one.",
  },
} as const;

export type Term = keyof typeof GLOSSARY;

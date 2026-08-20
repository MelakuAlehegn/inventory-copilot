// ─── Inventory ────────────────────────────────────────────────────────────────
export type InventoryStatus = "healthy" | "reorder" | "critical" | "overstock";

export interface InventoryItem {
  unique_id: string;
  item_id: string;
  store_id: string;
  current_stock: number;
  reorder_point: number;
  safety_stock: number;
  order_up_to: number;
  recommended_order_qty: number;
  mean_daily_demand: number;
  days_until_stockout: number | null;
  status: InventoryStatus;
  unit_price: number | null;
}

export interface InventorySummary {
  total: number;
  critical: number;
  reorder: number;
  healthy: number;
  overstock: number;
  alert_count: number;
}

// ─── Forecast ─────────────────────────────────────────────────────────────────
export interface ForecastPoint {
  ds: string;
  q50: number;
  q80: number;
  q90: number;
  q95: number;
  q99: number;
  actual: number | null;
}

export interface ForecastSeries {
  unique_id: string;
  cutoff: string;
  points: ForecastPoint[];
}

export interface ForecastSummary {
  wrmsse_model: number;
  wrmsse_naive: number;
  wrmsse_improvement: number;
  mean_rmsse_model: number;
  pinball_mean: number;
  n_series: number;
}

export interface SeriesOptions {
  items: string[];
  stores: string[];
}

// ─── Simulation / Decisions ───────────────────────────────────────────────────
export interface PolicyMetrics {
  fill_rate: number;
  stockout_units: number;
  stockout_day_rate: number;
  avg_on_hand: number;
  holding_cost: number;
  stockout_cost: number;
  ordering_cost: number;
  total_cost: number;
}

export interface CompareResult {
  base_stock: PolicyMetrics;
  naive: PolicyMetrics;
  delta: Record<string, number>;
}

// Backend ParetoRow + a computed combined_cost (holding_cost + stockout_cost).
export interface ParetoPoint {
  service_level: number;
  policy: string;
  fill_rate: number;
  stockout_units: number;
  stockout_day_rate: number;
  avg_on_hand: number;
  holding_cost: number;
  stockout_cost: number;
  ordering_cost: number;
  total_cost: number;
  combined_cost: number;
}

export interface ForecastScore {
  wrmsse_model: number;
  wrmsse_naive: number;
  wrmsse_improvement: number;
  mean_rmsse_model: number;
  pinball_mean: number;
  n_series: number;
}

export interface DecisionScore {
  service_level: number;
  fill_rate_model: number;
  fill_rate_naive: number;
  stockout_day_rate_model: number;
  stockout_day_rate_naive: number;
  stockout_units_reduction: number;
  holding_cost_reduction: number;
  stockout_cost_reduction: number;
  total_cost_reduction: number;
}

export interface Scorecard {
  forecast: ForecastScore;
  decision: DecisionScore;
}

// ─── What-If Scenario ─────────────────────────────────────────────────────────
// Mirrors the backend ScenarioRequest field names exactly.
export interface ScenarioParams {
  policy?: "base_stock" | "naive";
  lead_time?: number;
  review_period?: number;
  service_level?: number;
  demand_multiplier?: number;
  price_multiplier?: number;
  elasticity?: number;
  shock_start?: string | null;
  shock_end?: string | null;
}

export interface CompareParams {
  lead_time?: number;
  review_period?: number;
  service_level?: number;
}

export interface SavedScenario {
  id: string;
  name: string;
  params: ScenarioParams;
  created_at: string;
  updated_at: string;
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export interface KPISummary {
  n_series: number;
  n_stores: number;
  start_date: string;
  end_date: string;
  total_units: number;
  total_revenue: number;
  avg_daily_demand: number;
}

export interface TopItem {
  unique_id: string;
  item_id: string;
  store_id: string;
  units: number;
  revenue: number | null;
}

export interface StoreMetrics {
  store_id: string;
  n_series: number;
  total_units: number;
  total_revenue: number | null;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export interface ChatSession {
  id: string;
  title: string | null;
  page: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  tool_calls?: ToolCallTrace[] | null;
  created_at: string;
}

export interface ToolCallTrace {
  tool_name: string;
  args: Record<string, unknown>;
  result_summary?: string;
}

export interface SSEEvent {
  type: "tool" | "message" | "done" | "error";
  data: string | ToolCallTrace;
}

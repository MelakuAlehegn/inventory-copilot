// ─── Inventory ────────────────────────────────────────────────────────────────
export interface InventoryItem {
  item_id: string;
  store_id: string;
  category: string;
  name: string;
  current_stock: number;
  reorder_point: number;
  order_up_to: number;
  lead_time_days: number;
  review_period_days: number;
  unit_price: number;
  status: "ok" | "reorder" | "critical" | "overstock";
  days_until_stockout: number | null;
  fill_rate: number;
  last_updated: string;
}

// ─── Forecast ─────────────────────────────────────────────────────────────────
export interface ForecastPoint {
  date: string;
  q50: number;
  q80: number;
  q90: number;
  q95: number;
  q99: number;
  actual?: number;
}

export interface ForecastSummary {
  wrmsse: number;
  wrmsse_vs_naive: number;
  wrmsse_improvement_pct: number;
  mean_pinball: number;
  n_series: number;
  horizon_days: number;
}

// ─── Simulation / Decisions ───────────────────────────────────────────────────
export interface PolicyMetrics {
  policy: string;
  fill_rate: number;
  stockout_units: number;
  stockout_day_rate: number;
  avg_on_hand: number;
  holding_cost: number;
  stockout_cost: number;
  ordering_cost: number;
  total_cost: number;
}

export interface ParetoPoint {
  service_level: number;
  policy: string;
  fill_rate: number;
  holding_cost: number;
  stockout_cost: number;
  combined_cost: number;
}

// ─── What-If Scenario ─────────────────────────────────────────────────────────
export interface ScenarioParams {
  policy?: "base_stock" | "naive";
  lead_time_days?: number;
  review_period_days?: number;
  service_level?: number;
  demand_multiplier?: number;
  price_multiplier?: number;
  elasticity?: number;
  shock_start?: string | null;
  shock_end?: string | null;
  holding_rate?: number;
  order_cost?: number;
  stockout_penalty?: number;
}

export interface ScenarioResult {
  params: ScenarioParams;
  metrics: PolicyMetrics;
  vs_baseline: Partial<PolicyMetrics>;
}

export interface SavedScenario {
  id: string;
  name: string;
  created_at: string;
  params: ScenarioParams;
  metrics: PolicyMetrics;
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export interface TopItem {
  item_id: string;
  name: string;
  category: string;
  total_revenue: number;
  total_units: number;
  avg_daily_sales: number;
  store_count: number;
}

export interface StoreMetrics {
  store_id: string;
  state: string;
  total_revenue: number;
  total_units: number;
  fill_rate: number;
  item_count: number;
}

export interface KPISummary {
  forecast_improvement_pct: number;
  mean_fill_rate: number;
  items_at_risk: number;
  reorder_needed: number;
  total_items: number;
  stockout_day_rate: number;
  avg_holding_cost_per_unit: number;
  cost_reduction_pct: number;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  message_count: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls?: ToolCallTrace[];
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

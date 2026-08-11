import type {
  KPISummary,
  InventoryItem,
  ForecastSummary,
  ForecastPoint,
  PolicyMetrics,
  ParetoPoint,
  ScenarioResult,
  SavedScenario,
  ScenarioParams,
  TopItem,
  StoreMetrics,
  ChatSession,
  ChatMessage,
} from "@/lib/types";

// ─── Mock data ────────────────────────────────────────────────────────────────
const mockKPI: KPISummary = {
  forecast_improvement_pct: 19.6,
  mean_fill_rate: 0.9315,
  items_at_risk: 47,
  reorder_needed: 312,
  total_items: 3049,
  stockout_day_rate: 0.035,
  avg_holding_cost_per_unit: 0.42,
  cost_reduction_pct: 1.4,
};

const mockInventory: InventoryItem[] = Array.from({ length: 40 }, (_, i) => {
  const statuses = ["ok", "reorder", "critical", "overstock"] as const;
  const cats = ["FOODS_1", "FOODS_2", "FOODS_3"];
  const stores = ["CA_1", "CA_2", "CA_3", "TX_1", "TX_2", "WI_1"];
  const status = statuses[i % 4];
  return {
    item_id: `FOODS_${(i % 3) + 1}_${String(i + 1).padStart(3, "0")}`,
    store_id: stores[i % stores.length],
    category: cats[i % cats.length],
    name: `Product ${String(i + 1).padStart(3, "0")}`,
    current_stock: Math.round(20 + Math.random() * 200),
    reorder_point: Math.round(30 + Math.random() * 50),
    order_up_to: Math.round(80 + Math.random() * 120),
    lead_time_days: [3, 5, 7, 10, 14][i % 5],
    review_period_days: 7,
    unit_price: parseFloat((1.5 + Math.random() * 8).toFixed(2)),
    status,
    days_until_stockout: status === "critical" ? Math.round(1 + Math.random() * 4) : status === "reorder" ? Math.round(5 + Math.random() * 10) : null,
    fill_rate: 0.88 + Math.random() * 0.12,
    last_updated: new Date(Date.now() - i * 3_600_000).toISOString(),
  };
});

const mockForecastSummary: ForecastSummary = {
  wrmsse: 0.8896,
  wrmsse_vs_naive: 1.1061,
  wrmsse_improvement_pct: 19.6,
  mean_pinball: 0.5066,
  n_series: 14370,
  horizon_days: 28,
};

const mockForecastPoints: ForecastPoint[] = Array.from({ length: 28 }, (_, i) => {
  const base = 45 + Math.sin(i / 3.5) * 12 + Math.random() * 8;
  return {
    date: new Date(Date.now() - (28 - i) * 86_400_000).toISOString().split("T")[0],
    q50: parseFloat(base.toFixed(1)),
    q80: parseFloat((base * 1.18).toFixed(1)),
    q90: parseFloat((base * 1.28).toFixed(1)),
    q95: parseFloat((base * 1.38).toFixed(1)),
    q99: parseFloat((base * 1.55).toFixed(1)),
    actual: i < 20 ? parseFloat((base * (0.93 + Math.random() * 0.14)).toFixed(1)) : undefined,
  };
});

const mockBaseline: PolicyMetrics = {
  policy: "naive",
  fill_rate: 0.9229,
  stockout_units: 64150,
  stockout_day_rate: 0.043,
  avg_on_hand: 21.17,
  holding_cost: 169800,
  stockout_cost: 192450,
  ordering_cost: 467000,
  total_cost: 829250,
};

const mockPolicy: PolicyMetrics = {
  policy: "base_stock",
  fill_rate: 0.9315,
  stockout_units: 56992,
  stockout_day_rate: 0.035,
  avg_on_hand: 20.56,
  holding_cost: 166750,
  stockout_cost: 170900,
  ordering_cost: 467000,
  total_cost: 804650,
};

const mockPareto: ParetoPoint[] = [0.9, 0.95, 0.98, 0.99].flatMap((sl) => [
  {
    service_level: sl,
    policy: "base_stock",
    fill_rate: 0.909 + sl * 0.048,
    holding_cost: 155000 + sl * 40000,
    stockout_cost: 210000 - sl * 60000,
    combined_cost: 365000 - sl * 20000,
  },
  {
    service_level: sl,
    policy: "naive",
    fill_rate: 0.913 + sl * 0.024,
    holding_cost: 162000 + sl * 44000,
    stockout_cost: 225000 - sl * 55000,
    combined_cost: 387000 - sl * 11000,
  },
]);

const mockTopItems: TopItem[] = Array.from({ length: 12 }, (_, i) => ({
  item_id: `FOODS_1_${String(i + 1).padStart(3, "0")}`,
  name: `Top Product ${i + 1}`,
  category: ["FOODS_1", "FOODS_2", "FOODS_3"][i % 3],
  total_revenue: 120000 - i * 8000,
  total_units: 45000 - i * 3000,
  avg_daily_sales: 180 - i * 12,
  store_count: [10, 8, 6, 4][i % 4],
}));

const mockStores: StoreMetrics[] = [
  { store_id: "CA_1", state: "California", total_revenue: 420000, total_units: 158000, fill_rate: 0.938, item_count: 3049 },
  { store_id: "CA_2", state: "California", total_revenue: 385000, total_units: 144000, fill_rate: 0.931, item_count: 3049 },
  { store_id: "CA_3", state: "California", total_revenue: 362000, total_units: 136000, fill_rate: 0.929, item_count: 3049 },
  { store_id: "TX_1", state: "Texas", total_revenue: 398000, total_units: 149000, fill_rate: 0.934, item_count: 3049 },
  { store_id: "TX_2", state: "Texas", total_revenue: 371000, total_units: 140000, fill_rate: 0.926, item_count: 3049 },
  { store_id: "WI_1", state: "Wisconsin", total_revenue: 298000, total_units: 112000, fill_rate: 0.921, item_count: 3049 },
  { store_id: "WI_2", state: "Wisconsin", total_revenue: 281000, total_units: 106000, fill_rate: 0.918, item_count: 3049 },
];

const mockSessions: ChatSession[] = [
  { id: "s1", title: "Reorder strategy for FOODS_3", created_at: new Date(Date.now() - 3_600_000).toISOString(), message_count: 6 },
  { id: "s2", title: "What if lead time doubles?", created_at: new Date(Date.now() - 86_400_000).toISOString(), message_count: 4 },
  { id: "s3", title: "Service level 95% vs 99%", created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), message_count: 8 },
];

// ─── API Client ───────────────────────────────────────────────────────────────
class APIClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...init?.headers,
      },
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
    return res.json();
  }

  // ── KPIs ────────────────────────────────────────────────────────────────────
  async getKPIs(): Promise<KPISummary> {
    try { return await this.fetch<KPISummary>("/analytics/kpis"); }
    catch { return mockKPI; }
  }

  // ── Inventory ────────────────────────────────────────────────────────────────
  async getInventory(params?: { status?: string; store?: string; search?: string }): Promise<InventoryItem[]> {
    try {
      const q = new URLSearchParams(params as Record<string, string>);
      return await this.fetch<InventoryItem[]>(`/inventory?${q}`);
    } catch {
      let items = mockInventory;
      if (params?.status) items = items.filter((i) => i.status === params.status);
      if (params?.store) items = items.filter((i) => i.store_id === params.store);
      if (params?.search) {
        const s = params.search.toLowerCase();
        items = items.filter((i) => i.item_id.toLowerCase().includes(s) || i.name.toLowerCase().includes(s));
      }
      return items;
    }
  }

  // ── Forecast ─────────────────────────────────────────────────────────────────
  async getForecastSummary(): Promise<ForecastSummary> {
    try { return await this.fetch<ForecastSummary>("/forecast/summary"); }
    catch { return mockForecastSummary; }
  }

  async getForecastPoints(itemId?: string, storeId?: string): Promise<ForecastPoint[]> {
    try {
      const q = new URLSearchParams({ ...(itemId ? { item_id: itemId } : {}), ...(storeId ? { store_id: storeId } : {}) });
      return await this.fetch<ForecastPoint[]>(`/forecast/series?${q}`);
    } catch { return mockForecastPoints; }
  }

  // ── Decisions ─────────────────────────────────────────────────────────────────
  async comparePolicies(serviceLevel = 0.95): Promise<{ base_stock: PolicyMetrics; naive: PolicyMetrics }> {
    try { return await this.fetch(`/decisions/compare?service_level=${serviceLevel}`); }
    catch { return { base_stock: mockPolicy, naive: mockBaseline }; }
  }

  async getPareto(): Promise<ParetoPoint[]> {
    try { return await this.fetch<ParetoPoint[]>("/decisions/pareto"); }
    catch { return mockPareto; }
  }

  // ── What-If ───────────────────────────────────────────────────────────────────
  async runWhatIf(params: ScenarioParams): Promise<ScenarioResult> {
    try {
      return await this.fetch<ScenarioResult>("/decisions/what-if", {
        method: "POST",
        body: JSON.stringify(params),
      });
    } catch {
      // Simulate result deterministically
      const multiplier = params.demand_multiplier ?? 1;
      const sl = params.service_level ?? 0.95;
      return {
        params,
        metrics: {
          policy: params.policy ?? "base_stock",
          fill_rate: Math.min(0.999, mockPolicy.fill_rate * (1 - (multiplier - 1) * 0.4) + (sl - 0.95) * 0.3),
          stockout_units: Math.round(mockPolicy.stockout_units * multiplier * 1.1),
          stockout_day_rate: mockPolicy.stockout_day_rate * multiplier,
          avg_on_hand: mockPolicy.avg_on_hand * (1 + (sl - 0.95) * 2),
          holding_cost: mockPolicy.holding_cost * (1 + (sl - 0.95) * 2),
          stockout_cost: mockPolicy.stockout_cost * multiplier,
          ordering_cost: mockPolicy.ordering_cost,
          total_cost: mockPolicy.total_cost * (0.95 + multiplier * 0.05),
        },
        vs_baseline: {
          fill_rate: mockPolicy.fill_rate - mockBaseline.fill_rate,
          stockout_units: mockPolicy.stockout_units - mockBaseline.stockout_units,
          total_cost: mockPolicy.total_cost - mockBaseline.total_cost,
        },
      };
    }
  }

  async getSavedScenarios(): Promise<SavedScenario[]> {
    try { return await this.fetch<SavedScenario[]>("/scenarios"); }
    catch { return []; }
  }

  async saveScenario(name: string, params: ScenarioParams, metrics: PolicyMetrics): Promise<SavedScenario> {
    return await this.fetch<SavedScenario>("/scenarios", {
      method: "POST",
      body: JSON.stringify({ name, params, metrics }),
    });
  }

  // ── Analytics ─────────────────────────────────────────────────────────────────
  async getTopItems(limit = 12): Promise<TopItem[]> {
    try { return await this.fetch<TopItem[]>(`/analytics/top-items?limit=${limit}`); }
    catch { return mockTopItems.slice(0, limit); }
  }

  async getStoreMetrics(): Promise<StoreMetrics[]> {
    try { return await this.fetch<StoreMetrics[]>("/analytics/stores"); }
    catch { return mockStores; }
  }

  // ── Chat ──────────────────────────────────────────────────────────────────────
  async getChatSessions(): Promise<ChatSession[]> {
    try { return await this.fetch<ChatSession[]>("/chat/sessions"); }
    catch { return mockSessions; }
  }

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    try { return await this.fetch<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`); }
    catch { return []; }
  }

  streamChat(sessionId: string | null, userMessage: string, token: string): EventSource {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const url = new URL(`${base}/chat/stream`);
    // EventSource doesn't support POST + headers natively — use fetch SSE in the component
    return new EventSource(url.toString());
  }

  async* streamChatFetch(
    sessionId: string | null,
    userMessage: string,
    token: string
  ): AsyncGenerator<{ type: string; data: string }> {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${base}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ session_id: sessionId, message: userMessage }),
    });

    if (!res.ok || !res.body) {
      // Fallback: simulate a streamed response
      yield { type: "tool", data: JSON.stringify({ tool_name: "compare_policies", args: { service_level: 0.95 } }) };
      await new Promise((r) => setTimeout(r, 800));
      yield { type: "message", data: "At a 95% service level, the forecast-driven base-stock policy achieves a **93.2% fill rate** compared to **92.3%** for the naive baseline — a +11.2% reduction in stockout units (56,992 vs 64,150). Total cost is reduced by 1.4%. The key advantage: the forecast places buffer stock on high-demand days rather than spreading it uniformly." };
      yield { type: "done", data: "" };
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";
      for (const chunk of lines) {
        const eventLine = chunk.split("\n").find((l) => l.startsWith("event:"))?.replace("event:", "").trim();
        const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"))?.replace("data:", "").trim();
        if (eventLine && dataLine) yield { type: eventLine, data: dataLine };
      }
    }
  }
}

export const api = new APIClient();

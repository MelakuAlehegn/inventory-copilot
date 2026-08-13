import type {
  KPISummary,
  InventoryItem,
  ForecastSummary,
  ForecastSeries,
  PolicyMetrics,
  CompareResult,
  CompareParams,
  ParetoPoint,
  Scorecard,
  ScenarioParams,
  SavedScenario,
  TopItem,
  StoreMetrics,
  ChatSession,
  ChatMessage,
} from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Drop undefined/null/empty values so we never emit "undefined" in a query string.
function toQuery(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * Create an API client bound to a single auth token. Every request sends
 * `Authorization: Bearer <token>` when a token is present. On a non-2xx
 * response the underlying fetch throws — callers handle loading/error state.
 */
export function apiClient(token?: string | null) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
    if (res.status === 204) return undefined as T;
    return res.json();
  }

  return {
    // ── Analytics ────────────────────────────────────────────────────────────
    getKPIs(): Promise<KPISummary> {
      return request<KPISummary>("/analytics/kpis");
    },

    getTopSeries(metric: "revenue" | "units" = "revenue", limit = 12): Promise<TopItem[]> {
      return request<TopItem[]>(`/analytics/top-series${toQuery({ metric, limit })}`);
    },

    getStores(): Promise<StoreMetrics[]> {
      return request<StoreMetrics[]>("/analytics/stores");
    },

    // ── Inventory ────────────────────────────────────────────────────────────
    getInventory(params?: {
      status?: string;
      store?: string;
      search?: string;
      limit?: number;
    }): Promise<InventoryItem[]> {
      const query = toQuery({
        status: params?.status,
        store: params?.store,
        search: params?.search,
        limit: params?.limit,
      });
      return request<InventoryItem[]>(`/inventory${query}`);
    },

    // ── Forecast ─────────────────────────────────────────────────────────────
    getForecastSummary(): Promise<ForecastSummary> {
      return request<ForecastSummary>("/forecast/summary");
    },

    getForecastSeries(uniqueId: string): Promise<ForecastSeries> {
      return request<ForecastSeries>(`/forecast/series/${encodeURIComponent(uniqueId)}`);
    },

    // ── Decisions ────────────────────────────────────────────────────────────
    comparePolicies(params: CompareParams = {}): Promise<CompareResult> {
      return request<CompareResult>("/decisions/compare", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    runWhatIf(params: ScenarioParams): Promise<PolicyMetrics> {
      return request<PolicyMetrics>("/decisions/what-if", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    async getPareto(serviceLevels?: number[]): Promise<ParetoPoint[]> {
      const q = serviceLevels?.length
        ? "?" + serviceLevels.map((s) => `service_levels=${s}`).join("&")
        : "";
      const rows = await request<Omit<ParetoPoint, "combined_cost">[]>(`/decisions/pareto${q}`);
      // combined_cost is not returned by the backend; compute it here.
      return rows.map((r) => ({ ...r, combined_cost: r.holding_cost + r.stockout_cost }));
    },

    getScorecard(): Promise<Scorecard> {
      return request<Scorecard>("/decisions/scorecard");
    },

    // ── Scenarios (CRUD) ───────────────────────────────────────────────────────
    getScenarios(): Promise<SavedScenario[]> {
      return request<SavedScenario[]>("/scenarios");
    },

    saveScenario(name: string, params: ScenarioParams): Promise<SavedScenario> {
      return request<SavedScenario>("/scenarios", {
        method: "POST",
        body: JSON.stringify({ name, params }),
      });
    },

    deleteScenario(id: string): Promise<void> {
      return request<void>(`/scenarios/${id}`, { method: "DELETE" });
    },

    // ── Chat ───────────────────────────────────────────────────────────────────
    getChatSessions(): Promise<ChatSession[]> {
      return request<ChatSession[]>("/chat/sessions");
    },

    getMessages(sessionId: string): Promise<ChatMessage[]> {
      return request<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`);
    },

    async *streamChatFetch(
      sessionId: string | null,
      userMessage: string,
      context?: Record<string, string | number> | null
    ): AsyncGenerator<{ type: string; data: string }> {
      const res = await fetch(`${BASE}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMessage,
          ...(context ? { context } : {}),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Chat stream error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Frames are separated by a blank line; the server uses CRLF (sse_starlette),
        // so accept \r\n\r\n and \n\n. Lines split on either CRLF or LF.
        const frames = buffer.split(/\r\n\r\n|\n\n/);
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const lines = frame.split(/\r\n|\n/);
          const eventLine = lines.find((l) => l.startsWith("event:"))?.slice(6).trim();
          const dataLine = lines.find((l) => l.startsWith("data:"))?.slice(5).trim();
          // Per the SSE spec a frame with no event field defaults to "message".
          if (dataLine !== undefined) yield { type: eventLine ?? "message", data: dataLine };
        }
      }
    },
  };
}

export type ApiClient = ReturnType<typeof apiClient>;

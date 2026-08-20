import type {
  KPISummary,
  InventoryItem,
  InventorySummary,
  ForecastSummary,
  ForecastSeries,
  SeriesOptions,
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

// ── Process-level cache for global, read-only GETs ──────────────────────────────
// The Next fetch Data Cache is a no-op under `next dev --turbopack`, so we keep our own
// short-lived cache keyed by URL. It lives at module scope, so it's shared across requests
// in the Node server (and per tab in the browser). Only used for global/static endpoints,
// so sharing across users is correct. Stores the in-flight promise to dedupe concurrent
// calls; evicts on error so failures aren't cached.
const CACHE_TTL_MS = 300_000; // 5 minutes
const _getCache = new Map<string, { expires: number; value: Promise<unknown> }>();

function cachedFetch<T>(key: string, run: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = _getCache.get(key);
  if (hit && hit.expires > now) return hit.value as Promise<T>;
  const value = run().catch((err) => {
    _getCache.delete(key);
    throw err;
  });
  _getCache.set(key, { expires: now + CACHE_TTL_MS, value });
  return value;
}

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
 * response the underlying fetch throws - callers handle loading/error state.
 */
export function apiClient(token?: string | null) {
  // Global, read-only results are static for the life of a backend run, so let Next's
  // Data Cache reuse them across navigations (server components) instead of re-fetching.
  // A short window still picks up a data rebuild. No-op in the browser (client fetches).
  const CACHE_SECONDS = 300;

  async function request<T>(path: string, init?: RequestInit, revalidate?: number): Promise<T> {
    const opts: RequestInit = {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    };
    if (revalidate !== undefined) {
      (opts as { next?: { revalidate: number } }).next = { revalidate };
    }
    const res = await fetch(`${BASE}${path}`, opts);
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
    if (res.status === 204) return undefined as T;
    return res.json();
  }

  // GET a global/read-only endpoint through the process-level cache (keyed by path).
  const getCached = <T>(path: string): Promise<T> =>
    cachedFetch<T>(path, () => request<T>(path, undefined, CACHE_SECONDS));

  return {
    // ── Analytics ────────────────────────────────────────────────────────────
    getKPIs(): Promise<KPISummary> {
      return getCached<KPISummary>("/analytics/kpis");
    },

    getTopSeries(metric: "revenue" | "units" = "revenue", limit = 12): Promise<TopItem[]> {
      return getCached<TopItem[]>(`/analytics/top-series${toQuery({ metric, limit })}`);
    },

    getStores(): Promise<StoreMetrics[]> {
      return getCached<StoreMetrics[]>("/analytics/stores");
    },

    // ── Inventory ────────────────────────────────────────────────────────────
    getInventory(params?: {
      status?: string;
      store?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }): Promise<InventoryItem[]> {
      const query = toQuery({
        status: params?.status,
        store: params?.store,
        search: params?.search,
        limit: params?.limit,
        offset: params?.offset,
      });
      return getCached<InventoryItem[]>(`/inventory${query}`);
    },

    getInventorySummary(): Promise<InventorySummary> {
      return getCached<InventorySummary>("/inventory/summary");
    },

    // ── Forecast ─────────────────────────────────────────────────────────────
    getForecastSummary(): Promise<ForecastSummary> {
      return getCached<ForecastSummary>("/forecast/summary");
    },

    getForecastSeries(uniqueId: string): Promise<ForecastSeries> {
      return getCached<ForecastSeries>(`/forecast/series/${encodeURIComponent(uniqueId)}`);
    },

    getSeriesOptions(): Promise<SeriesOptions> {
      return getCached<SeriesOptions>("/forecast/options");
    },

    // ── Decisions ────────────────────────────────────────────────────────────
    comparePolicies(params: CompareParams = {}): Promise<CompareResult> {
      // POST, but deterministic and global - cache by params (keyed distinctly from GETs).
      return cachedFetch<CompareResult>(`POST /decisions/compare:${JSON.stringify(params)}`, () =>
        request<CompareResult>("/decisions/compare", {
          method: "POST",
          body: JSON.stringify(params),
        })
      );
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
      const rows = await getCached<Omit<ParetoPoint, "combined_cost">[]>(`/decisions/pareto${q}`);
      // combined_cost is not returned by the backend; compute it here.
      return rows.map((r) => ({ ...r, combined_cost: r.holding_cost + r.stockout_cost }));
    },

    getScorecard(): Promise<Scorecard> {
      return getCached<Scorecard>("/decisions/scorecard");
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

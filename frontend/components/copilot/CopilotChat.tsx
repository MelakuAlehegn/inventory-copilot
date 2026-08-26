"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { apiClient } from "@/lib/api";
import type { ChatSession, ChatMessage, ToolCallTrace } from "@/lib/types";
import { Terminal, Loader2, MessageSquare, ChevronDown, Plus, History, Trash2, Check, Square, Paperclip, ArrowUp, Brain, Wrench, ShieldCheck, Sparkles, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/app/modal";

// Shown on the full /copilot workspace and as a fallback for any unrecognized page.
const DEFAULT_SUGGESTIONS = [
  "Compare base-stock vs naive at 95% service level",
  "What if demand increases by 30%?",
  "Run the Pareto curve across service levels 90%–99%",
  "What safety stock do we need at 99% service level?",
  "Explain why the forecast-driven policy beats naive",
];

// Page-relevant starters for the docked panel, so each page suggests what it is good for.
const SUGGESTIONS_BY_PAGE: Record<string, string[]> = {
  dashboard: [
    "Why does the forecast-driven policy beat the naive baseline?",
    "Compare base-stock vs naive at 95% service level",
    "What is the trade-off between cost and service level?",
  ],
  analytics: [
    "Compare base-stock vs naive at 95% service level",
    "Run the Pareto curve across service levels 90%–99%",
    "What if demand runs 20% hotter than forecast?",
  ],
  forecast: [
    "Why is the forecast-driven policy more accurate than naive?",
    "What if demand increases by 30%?",
    "What safety stock covers demand at the 99% service level?",
  ],
  inventory: [
    "What safety stock do we need at 99% service level?",
    "How does a longer lead time change our stock cover?",
    "Compare base-stock vs naive at 95% service level",
  ],
  scenarios: [
    "What if demand increases by 30%?",
    "Run the Pareto curve across service levels 90%–99%",
    "What setup reaches a 93% fill rate under a demand shock?",
    "How does raising the service level change total cost?",
  ],
};

// Mirrors the agent's real tools (see backend agent/tools.py).
const TOOLS: { name: string; desc: string }[] = [
  { name: "run_what_if", desc: "One what-if scenario: service + cost metrics" },
  { name: "compare_policies", desc: "Base-stock vs naive at one setting" },
  { name: "get_pareto_curve", desc: "Cost vs service-level frontier" },
  { name: "get_inventory_item", desc: "One item's position + reorder recommendation" },
  { name: "get_item_forecast", desc: "One item's demand forecast over the horizon" },
  { name: "query_data", desc: "Read-only SQL over historical sales/prices/events" },
];

/** One step in the agent's live trajectory: a tool call, its args, and (once run) a result. */
interface AgentStep {
  name: string;
  args?: Record<string, unknown>;
  summary?: string;
  done: boolean;
  startedAt?: number;
  durationMs?: number;
}

function argsJson(args?: Record<string, unknown>): string {
  if (!args) return "";
  const s = JSON.stringify(args);
  return s.length > 140 ? s.slice(0, 140) + "…" : s;
}

// Static description + icon for each backend phase label (the stream only sends the label).
const PHASE_META: Record<string, { icon: React.ElementType; description: string }> = {
  Thinking: { icon: Brain, description: "Parsing the request and identifying the data needed." },
  "Running tools": { icon: Wrench, description: "Running tools to gather the figures." },
  "Verifying the figures": { icon: ShieldCheck, description: "Checking every number against a tool result." },
  "Double-checking the numbers": { icon: ShieldCheck, description: "Re-checking figures that need another look." },
  Finalizing: { icon: Sparkles, description: "Composing the grounded answer." },
};

// Phases to show for a finished message (the sequence isn't persisted, so reconstruct it).
function canonicalPhases(hasTools: boolean): string[] {
  return ["Thinking", ...(hasTools ? ["Running tools"] : []), "Verifying the figures", "Finalizing"];
}

/** Render an assistant answer, turning **bold** markers into emphasised (mono) spans. */
function renderAnswer(text: string): ReactNode {
  return text.split("\n").map((line, li) => (
    <p key={li} className={li > 0 ? "mt-2" : ""}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
        chunk.startsWith("**") && chunk.endsWith("**") ? (
          <strong key={i} className="num font-semibold text-foreground">{chunk.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{chunk}</span>
        ),
      )}
    </p>
  ));
}

/** One tool call, nested inside the "Running tools" phase card. */
function ToolCard({ step }: { step: AgentStep }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <div className="flex items-center gap-2">
        <span className="num text-[13px] font-semibold">{step.name}</span>
        <span className={cn("text-[11px] font-semibold", step.done ? "text-success" : "text-primary")}>
          {step.done ? "Completed" : "Running"}
        </span>
        <span className="num ml-auto text-[11px] text-muted-foreground">
          {step.durationMs != null ? `${(step.durationMs / 1000).toFixed(1)}s` : !step.done ? <Loader2 className="size-3.5 animate-spin" /> : null}
        </span>
      </div>
      {step.args ? (
        <div className="num mt-2 break-all rounded-md bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">{argsJson(step.args)}</div>
      ) : null}
      {step.summary ? (
        <p className="num mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <FileText className="mt-0.5 size-3.5 shrink-0 text-success" /> <span className="min-w-0 break-words">{step.summary}</span>
        </p>
      ) : null}
    </div>
  );
}

/** The staged run as big phase cards (icon + description + status), with the tool calls nested
 * inside the "Running tools" phase, matching the design. */
function Trajectory({ phases, steps, active }: { phases: string[]; steps: AgentStep[]; active: boolean }) {
  if (!phases.length) return null;
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <span className="label-eyebrow">Agent trajectory</span>
        <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <span className={cn("size-1.5 rounded-full", active ? "bg-primary" : "bg-success")} />
          {active ? "In progress" : "Completed"}
        </span>
      </div>
      {phases.map((label, i) => {
        const meta = PHASE_META[label] ?? { icon: Wrench, description: "" };
        const Icon = meta.icon;
        const current = active && i === phases.length - 1;
        const isTools = label === "Running tools";
        return (
          <div key={i} className="panel p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isTools && steps.length ? `Executing ${steps.length} tool${steps.length > 1 ? "s" : ""}` : meta.description}
                </p>
                {isTools && steps.length ? (
                  <div className="mt-3 space-y-2">{steps.map((s, si) => <ToolCard key={si} step={s} />)}</div>
                ) : null}
              </div>
              <span className="shrink-0 text-xs font-semibold">
                {current ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : isTools ? (
                  <span className="flex items-center gap-1 text-success"><Check className="size-3.5" /> {doneCount}/{steps.length} done</span>
                ) : (
                  <span className="flex items-center gap-1 text-success"><Check className="size-3.5" /> Done</span>
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">{msg.content}</p>
      </div>
    );
  }
  const steps: AgentStep[] = Array.isArray(msg.tool_calls)
    ? msg.tool_calls.map((tc) => ({ name: tc.tool_name, summary: tc.result_summary, done: true }))
    : [];
  const phases = canonicalPhases(steps.length > 0);
  return (
    <div className="space-y-3">
      <Trajectory phases={phases} steps={steps} active={false} />
      <div className="text-sm leading-relaxed text-foreground">{renderAnswer(msg.content)}</div>
    </div>
  );
}

function StreamingMsg({ content, steps, phases }: { content: string; steps: AgentStep[]; phases: string[] }) {
  const showThinking = !phases.length && !steps.length && !content;
  return (
    <div className="space-y-3">
      {phases.length ? <Trajectory phases={phases} steps={steps} active={!content} /> : null}
      {showThinking ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> Thinking…
        </div>
      ) : null}
      {content ? (
        <div className="text-sm leading-relaxed text-foreground">
          {renderAnswer(content)}
          <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-primary align-text-bottom" />
        </div>
      ) : null}
    </div>
  );
}

/** Reveal already-verified answer text progressively (~0.6s total, length-independent). */
function typeOut(text: string, set: (s: string) => void): Promise<void> {
  return new Promise((resolve) => {
    const step = Math.max(2, Math.ceil(text.length / 40));
    let i = 0;
    const tick = () => {
      i = Math.min(text.length, i + step);
      set(text.slice(0, i));
      if (i >= text.length) resolve();
      else setTimeout(tick, 16);
    };
    tick();
  });
}

export interface CopilotChatProps {
  variant?: "full" | "panel";
  context?: Record<string, string | number> | null;
  initialQuery?: string;
  resetKey?: number;
  /** A suggested question to drop into the input (with a nonce); fills the input, never auto-sends. */
  pendingPrefill?: { text: string; nonce: number } | null;
}

/**
 * The complete chat engine - sessions, streaming, tool traces, input - rendered either as the
 * full workspace (`/copilot`) or as a compact docked panel on any data page. One implementation
 * so both stay in lock-step. All numbers come from real tool calls (grounding guardrail).
 */
export default function CopilotChat({ variant = "full", context, initialQuery, resetKey, pendingPrefill }: CopilotChatProps) {
  const { data: session } = useSession();
  const token = session?.backendToken;
  const isPanel = variant === "panel";

  const [sessions, setSessions]   = useState<ChatSession[]>([]);
  const [activeId, setActiveId]   = useState<string | null>(null);
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [input, setInput]         = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [, setStatus] = useState("");
  const [phases, setPhases] = useState<string[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false); // panel: show the history list
  const [pendingDelete, setPendingDelete] = useState<{ kind: "one"; id: string; title: string } | { kind: "all" } | null>(null);

  const msgsRef = useRef<HTMLDivElement>(null);
  const taRef   = useRef<HTMLTextAreaElement>(null);
  const sentInitial = useRef(false);
  const lastPrefillNonce = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);

  // Cancel an in-flight run (before the answer arrives).
  const stop = () => {
    stoppedRef.current = true;
    abortRef.current?.abort();
  };

  // The docked panel shows history for the current page only; the full workspace shows all.
  const pageFilter = isPanel ? (context?.page ? String(context.page) : undefined) : undefined;

  const refreshSessions = useCallback(() => {
    if (!token) return;
    apiClient(token).getChatSessions(pageFilter).then(setSessions).catch(() => setSessions([]));
  }, [token, pageFilter]);

  useEffect(() => { refreshSessions(); }, [refreshSessions]);

  const loadSession = (id: string) => {
    setActiveId(id);
    setHistoryOpen(false);
    if (token) apiClient(token).getMessages(id).then(setMessages).catch(() => setMessages([]));
  };

  const newChat = () => {
    setActiveId(null);
    setMessages([]);
    setInput("");
    setHistoryOpen(false);
  };

  const runDelete = async () => {
    if (!token || !pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      if (target.kind === "one") {
        await apiClient(token).deleteChatSession(target.id);
        setSessions((prev) => prev.filter((s) => s.id !== target.id));
        if (activeId === target.id) newChat();
      } else {
        await apiClient(token).clearChatSessions();
        setSessions([]);
        newChat();
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamContent, steps, phases]);

  // Grow the composer with its content (wrap to new lines instead of scrolling sideways),
  // capped so it never takes over the panel.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  // In the docked panel, changing pages starts a fresh chat (the old one stays in that
  // page's history). Skip the first mount so a prefilled question isn't wiped.
  const panelPage = isPanel ? (context?.page ? String(context.page) : "") : "";
  const prevPage = useRef<string | null>(null);
  useEffect(() => {
    if (!isPanel) return;
    if (prevPage.current === null) { prevPage.current = panelPage; return; }
    if (prevPage.current !== panelPage) {
      prevPage.current = panelPage;
      setActiveId(null);
      setMessages([]);
      setInput("");
      setHistoryOpen(false);
    }
  }, [panelPage, isPanel]);

  const sendMessage = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || streaming) return;

    const userMsg: ChatMessage = { id: `tmp-${Date.now()}`, role: "user", content: msg, created_at: new Date().toISOString() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setStreaming(true);
    setStreamContent("");
    setSteps([]);
    setStatus("");
    setPhases([]);

    stoppedRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;

    let fullContent = "";
    let sessionId = activeId; // capture the session the backend used/created
    const trajectory: AgentStep[] = [];

    try {
      for await (const event of apiClient(token).streamChatFetch(activeId, msg, context, controller.signal)) {
        if (event.type === "status") {
          const label = (JSON.parse(event.data) as { label?: string }).label ?? "";
          setStatus(label);
          if (label) setPhases((p) => (p[p.length - 1] === label ? p : [...p, label]));
        } else if (event.type === "tool") {
          const raw = JSON.parse(event.data) as { name?: string; args?: Record<string, unknown> };
          trajectory.push({ name: raw.name ?? "tool", args: raw.args, done: false, startedAt: Date.now() });
          setSteps([...trajectory]);
        } else if (event.type === "tool_result") {
          const raw = JSON.parse(event.data) as { name?: string; summary?: string };
          const pending = trajectory.find((s) => !s.done && s.name === raw.name);
          if (pending) {
            pending.done = true;
            pending.summary = raw.summary;
            if (pending.startedAt) pending.durationMs = Date.now() - pending.startedAt;
          }
          setSteps([...trajectory]);
        } else if (event.type === "message") {
          try {
            const parsed = JSON.parse(event.data) as { content?: string; session_id?: string };
            fullContent = parsed.content ?? "";
            if (parsed.session_id) sessionId = parsed.session_id;
          } catch { fullContent = event.data; }
          setStatus("");
        }
      }
    } catch {
      // A user-initiated stop aborts the fetch; that isn't a connection error.
      if (!stoppedRef.current) fullContent = "Sorry, I couldn't reach the backend. Please check your connection.";
    } finally {
      abortRef.current = null;
    }

    // Stopped before any answer: drop the live trajectory, keep the question.
    if (stoppedRef.current && !fullContent) {
      setStreaming(false);
      setStreamContent("");
      setSteps([]);
      setStatus("");
      setPhases([]);
      return;
    }

    // Reveal the verified answer progressively (grounding runs server-side before we get here).
    if (fullContent) await typeOut(fullContent, setStreamContent);

    trajectory.forEach((s) => { s.done = true; });
    const assistantMsg: ChatMessage = {
      id: `tmp-a-${Date.now()}`,
      role: "assistant",
      content: fullContent,
      tool_calls: trajectory.map((s) => ({ tool_name: s.name, result_summary: s.summary } as ToolCallTrace)),
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, assistantMsg]);
    setStreaming(false);
    setStreamContent("");
    setSteps([]);
    setStatus("");
    setPhases([]);

    // Keep sending to the same session (so a conversation is one history entry, not one per
    // message), and refresh the history list so the new/updated chat shows up.
    if (sessionId && sessionId !== activeId) setActiveId(sessionId);
    refreshSessions();
  }, [activeId, token, streaming, context, refreshSessions]);

  useEffect(() => {
    if (initialQuery && !sentInitial.current) {
      sentInitial.current = true;
      const t = setTimeout(() => sendMessage(initialQuery), 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  useEffect(() => {
    if (resetKey === undefined) return;
    setActiveId(null);
    setMessages([]);
    setInput("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Drop a suggested question into the input (do not send) and focus it, once per new nonce.
  useEffect(() => {
    if (pendingPrefill && pendingPrefill.nonce !== lastPrefillNonce.current) {
      lastPrefillNonce.current = pendingPrefill.nonce;
      setInput(pendingPrefill.text);
      taRef.current?.focus();
    }
  }, [pendingPrefill]);

  // Page-aware starters: the docked panel uses the current page's list (falling back to the
  // generic set); the full /copilot workspace always shows the generic set.
  const contextPage = context?.page ? String(context.page) : "";
  const pageSuggestions = SUGGESTIONS_BY_PAGE[contextPage] ?? DEFAULT_SUGGESTIONS;
  const suggestions = isPanel ? pageSuggestions.slice(0, 3) : DEFAULT_SUGGESTIONS;

  const welcome = (
    <div className={isPanel ? "space-y-5" : "space-y-6"}>
      {!isPanel ? (
        <div>
          <h2 className="text-base font-semibold">How can I help?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask about demand forecasts, inventory decisions, and what-if scenarios.
          </p>
        </div>
      ) : null}
      <div>
        <p className="label-eyebrow mb-2">Try asking</p>
        <ul className="space-y-1.5">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                onClick={() => sendMessage(s)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/40 hover:bg-copper-50"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  const conversation = (
    <div className={cn("space-y-6", isPanel ? "p-4" : "p-5")}>
      {messages.length === 0 && !streaming ? welcome : null}
      {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
      {streaming ? <StreamingMsg content={streamContent} steps={steps} phases={phases} /> : null}
    </div>
  );

  const composer = (
    <div className={cn("shrink-0 border-t border-border bg-surface", isPanel ? "p-2.5" : "p-4")}>
      <div className={isPanel ? "" : "mx-auto max-w-3xl"}>
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface-2 py-1.5 pl-4 pr-1.5 transition-colors focus-within:border-primary/50">
          <Paperclip className="mb-2 size-4 shrink-0 text-muted-foreground" />
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
            }}
            placeholder="Ask about demand, inventory, or scenarios..."
            className="max-h-[140px] min-w-0 flex-1 resize-none self-center bg-transparent py-1 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
            id="copilot-input"
          />
          {streaming ? (
            <button onClick={stop} aria-label="Stop" id="copilot-stop" className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button onClick={() => sendMessage(input)} disabled={!input.trim()} aria-label="Send" id="copilot-send" className="grid size-8 shrink-0 place-items-center rounded-full grad-primary text-primary-foreground transition-opacity disabled:opacity-40">
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const historyList = (
    <div>
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="label-eyebrow">History</span>
        {sessions.length > 0 ? (
          <button onClick={() => setPendingDelete({ kind: "all" })} className="text-[11px] text-muted-foreground transition-colors hover:text-danger">
            Clear all
          </button>
        ) : null}
      </div>
      <ul className="space-y-0.5">
        {sessions.map((s) => (
          <li
            key={s.id}
            className={cn("group flex items-center gap-1 rounded-md transition-colors hover:bg-secondary", activeId === s.id && "bg-copper-50")}
          >
            <button
              onClick={() => loadSession(s.id)}
              className={cn(
                "flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-2 text-left text-xs",
                activeId === s.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
              )}
            >
              <MessageSquare className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate">{s.title ?? "Untitled conversation"}</span>
                <span className="num text-[10px] opacity-70">{new Date(s.created_at).toLocaleDateString()}</span>
              </span>
            </button>
            <button
              onClick={() => setPendingDelete({ kind: "one", id: s.id, title: s.title ?? "Untitled conversation" })}
              className="mr-1 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:text-danger group-hover:opacity-100"
              aria-label="Delete chat"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
        {sessions.length === 0 ? <li className="px-2 py-4 text-center text-[11px] text-muted-foreground">No conversations yet</li> : null}
      </ul>
    </div>
  );

  const deleteModal = (
    <Modal open={!!pendingDelete} onClose={() => setPendingDelete(null)}>
      <h2 className="text-base font-semibold">{pendingDelete?.kind === "all" ? "Clear all history?" : "Delete chat?"}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {pendingDelete?.kind === "all"
          ? "All of these conversations will be permanently removed."
          : `"${pendingDelete?.kind === "one" ? pendingDelete.title : ""}" will be permanently removed.`}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>Cancel</Button>
        <Button variant="destructive" size="sm" onClick={runDelete}>Delete</Button>
      </div>
    </Modal>
  );

  if (isPanel) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
          <button onClick={newChat} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <Plus className="size-3.5" /> New
          </button>
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors", historyOpen ? "bg-copper-50 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}
            aria-pressed={historyOpen}
          >
            <History className="size-3.5" /> History
          </button>
        </div>
        <div ref={msgsRef} className="min-h-0 flex-1 overflow-y-auto">
          {historyOpen ? <div className="p-3">{historyList}</div> : conversation}
        </div>
        {historyOpen ? null : composer}
        {deleteModal}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0">
      {deleteModal}
      {/* History + tools rail */}
      <aside className="hidden w-[240px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-surface px-4 py-5 xl:flex">
        <div>{historyList}</div>
        <div>
          <button
            onClick={() => setToolsOpen((v) => !v)}
            className="label-eyebrow flex w-full items-center justify-between px-1 pb-2 transition-colors hover:text-foreground"
            aria-expanded={toolsOpen}
          >
            <span>Tools available</span>
            <ChevronDown className={cn("size-3.5 transition-transform", toolsOpen && "rotate-180")} />
          </button>
          {toolsOpen ? (
            <>
              <ul className="space-y-1.5">
                {TOOLS.map((t) => (
                  <li key={t.name} className="rounded-md border border-border px-2.5 py-2">
                    <p className="num flex items-center gap-1.5 text-[11px] font-medium text-primary"><Terminal className="size-3" />{t.name}</p>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t.desc}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 px-1 text-[11px] text-muted-foreground">Every figure is calculated from your data.</p>
            </>
          ) : null}
        </div>
      </aside>

      {/* Conversation + composer */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div ref={msgsRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl">{conversation}</div>
        </div>
        {composer}
      </div>
    </div>
  );
}

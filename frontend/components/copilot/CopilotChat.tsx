"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { apiClient } from "@/lib/api";
import type { ChatSession, ChatMessage, ToolCallTrace } from "@/lib/types";
import { Send, Terminal, Check, Loader2, MessageSquare, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const SUGGESTIONS = [
  "Compare base-stock vs naive at 95% service level",
  "What if demand increases by 30%?",
  "Run the Pareto curve across service levels 90%–99%",
  "What safety stock do we need at 99% service level?",
  "Explain why the forecast-driven policy beats naive",
];

const TOOLS: { name: string; desc: string }[] = [
  { name: "forecast_demand", desc: "Quantile demand forecast for an item/store" },
  { name: "compare_policies", desc: "Base-stock vs naive over the eval window" },
  { name: "run_simulation", desc: "Deterministic inventory simulation" },
  { name: "run_what_if", desc: "Parameter shock scenario" },
  { name: "get_pareto_curve", desc: "Cost vs service-level frontier" },
];

/** One step in the agent's live trajectory: a tool call, its args, and (once run) a result. */
interface AgentStep {
  name: string;
  args?: Record<string, unknown>;
  summary?: string;
  done: boolean;
}

function argsPreview(args?: Record<string, unknown>): string {
  if (!args) return "";
  const s = Object.entries(args)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(", ");
  return s.length > 90 ? s.slice(0, 90) + "…" : s;
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

function Trajectory({ steps, status }: { steps: AgentStep[]; status?: string }) {
  if (!steps.length && !status) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-2/60 p-3">
      <p className="label-eyebrow mb-3">Agent trajectory</p>
      <ol className="space-y-1.5">
        {steps.map((step, i) => (
          <li key={i} className="rounded-md border border-border bg-surface px-2.5 py-2">
            <div className="flex items-center gap-2">
              <Terminal className="size-3 text-primary" />
              <span className="num text-[11px] font-semibold">{step.name}</span>
              {step.done ? <Check className="ml-auto size-3 text-success" /> : <Loader2 className="ml-auto size-3 animate-spin text-primary" />}
            </div>
            {step.args ? <p className="num mt-1 text-[10px] leading-relaxed text-muted-foreground">{argsPreview(step.args)}</p> : null}
            {step.summary ? <p className="num mt-1 text-[10px] leading-relaxed text-success-foreground">→ {step.summary}</p> : null}
          </li>
        ))}
      </ol>
      {status ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin text-primary" /> {status}…
        </div>
      ) : null}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">{msg.content}</p>
      </div>
    );
  }
  const steps: AgentStep[] = Array.isArray(msg.tool_calls)
    ? msg.tool_calls.map((tc) => ({ name: tc.tool_name, summary: tc.result_summary, done: true }))
    : [];
  return (
    <div className="space-y-3">
      {steps.length > 0 ? <Trajectory steps={steps} /> : null}
      <div className="text-sm leading-relaxed text-foreground">{renderAnswer(msg.content)}</div>
    </div>
  );
}

function StreamingMsg({ content, steps, status }: { content: string; steps: AgentStep[]; status: string }) {
  return (
    <div className="space-y-3">
      <Trajectory steps={steps} status={content ? undefined : status} />
      {content ? (
        <div className="text-sm leading-relaxed text-foreground">
          {renderAnswer(content)}
          <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-primary align-text-bottom" />
        </div>
      ) : !steps.length && !status ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> Thinking…
        </div>
      ) : null}
    </div>
  );
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
  const [status, setStatus] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);

  const msgsRef = useRef<HTMLDivElement>(null);
  const taRef   = useRef<HTMLTextAreaElement>(null);
  const sentInitial = useRef(false);
  const lastPrefillNonce = useRef(0);

  useEffect(() => {
    if (!token || isPanel) return; // the panel keeps history out of the way
    apiClient(token).getChatSessions().then(setSessions).catch(() => setSessions([]));
  }, [token, isPanel]);

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamContent, steps, status]);

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

    let fullContent = "";
    const trajectory: AgentStep[] = [];

    try {
      for await (const event of apiClient(token).streamChatFetch(activeId, msg, context)) {
        if (event.type === "status") {
          setStatus((JSON.parse(event.data) as { label?: string }).label ?? "");
        } else if (event.type === "tool") {
          const raw = JSON.parse(event.data) as { name?: string; args?: Record<string, unknown> };
          trajectory.push({ name: raw.name ?? "tool", args: raw.args, done: false });
          setSteps([...trajectory]);
        } else if (event.type === "tool_result") {
          const raw = JSON.parse(event.data) as { name?: string; summary?: string };
          const pending = trajectory.find((s) => !s.done && s.name === raw.name);
          if (pending) { pending.done = true; pending.summary = raw.summary; }
          setSteps([...trajectory]);
        } else if (event.type === "message") {
          try { fullContent = (JSON.parse(event.data) as { content?: string }).content ?? ""; }
          catch { fullContent = event.data; }
          setStatus("");
          setStreamContent(fullContent);
        }
      }
    } catch {
      fullContent = "Sorry, I couldn't reach the backend. Please check your connection.";
      setStreamContent(fullContent);
    }

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
  }, [activeId, token, streaming, context]);

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

  const welcome = (
    <div className={isPanel ? "space-y-5" : "space-y-6"}>
      {!isPanel ? (
        <div>
          <h2 className="text-base font-semibold">Grounded inventory agent</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask about demand forecasts, inventory policy, and what-if scenarios. Every number is computed by a real tool, so the agent never invents a figure.
          </p>
        </div>
      ) : null}
      <div>
        <p className="label-eyebrow mb-2">Try asking</p>
        <ul className="space-y-1.5">
          {(isPanel ? SUGGESTIONS.slice(0, 3) : SUGGESTIONS).map((s) => (
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
      {streaming ? <StreamingMsg content={streamContent} steps={steps} status={status} /> : null}
    </div>
  );

  const composer = (
    <div className={cn("border-t border-border bg-surface", isPanel ? "p-2.5" : "p-3")}>
      <div className="relative">
        <Textarea
          ref={taRef}
          rows={isPanel ? 2 : 3}
          placeholder="Ask about inventory, forecasts, what-if scenarios…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
          }}
          disabled={streaming}
          className="resize-none bg-surface-2 pr-12 text-sm"
          id="copilot-input"
        />
        <Button
          size="icon"
          className="absolute bottom-2 right-2 size-8"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || streaming}
          aria-label="Send"
          id="copilot-send"
        >
          {streaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
      {!isPanel ? (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Press <span className="num rounded border border-border px-1">Enter</span> to send ·{" "}
          <span className="num rounded border border-border px-1">Shift+Enter</span> for newline
        </p>
      ) : null}
    </div>
  );

  if (isPanel) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div ref={msgsRef} className="min-h-0 flex-1 overflow-y-auto">{conversation}</div>
        {composer}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* History + tools rail */}
      <aside className="hidden w-[240px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-surface px-4 py-5 xl:flex">
        <div>
          <p className="label-eyebrow px-1 pb-2">History</p>
          <ul className="space-y-0.5">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setActiveId(s.id);
                    if (token) apiClient(token).getMessages(s.id).then(setMessages).catch(() => setMessages([]));
                  }}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors",
                    activeId === s.id ? "bg-copper-50 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <MessageSquare className="mt-0.5 size-3.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate">{s.title ?? "Untitled conversation"}</span>
                    <span className="num text-[10px] opacity-70">{new Date(s.created_at).toLocaleDateString()}</span>
                  </span>
                </button>
              </li>
            ))}
            {sessions.length === 0 ? <li className="px-2 py-4 text-center text-[11px] text-muted-foreground">No conversations yet</li> : null}
          </ul>
        </div>
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
              <p className="mt-3 px-1 text-[11px] text-muted-foreground">Grounding guardrail active; fabricated numbers are blocked.</p>
            </>
          ) : null}
        </div>
      </aside>

      {/* Conversation + composer */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div ref={msgsRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl">{conversation}</div>
        </div>
        <div className="mx-auto w-full max-w-3xl">{composer}</div>
      </div>
    </div>
  );
}

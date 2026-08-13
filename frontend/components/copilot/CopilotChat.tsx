"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { apiClient } from "@/lib/api";
import type { ChatSession, ChatMessage, ToolCallTrace } from "@/lib/types";
import { Send, Cpu, User, Zap } from "lucide-react";

const SUGGESTIONS = [
  "Compare base-stock vs naive at 95% service level",
  "What if demand increases by 30%?",
  "Run the Pareto curve across service levels 90%–99%",
  "What safety stock do we need at 99% service level?",
  "Explain why the forecast-driven policy beats naive",
];

const TOOLS = ["forecast_demand", "compare_policies", "run_simulation", "run_what_if", "get_pareto_curve"];

function ToolCallBadge({ trace }: { trace: ToolCallTrace }) {
  return (
    <div className="tool-step running" style={{ display: "inline-flex" }}>
      <Zap size={12} />
      <span style={{ fontFamily: "var(--ff-mono)" }}>{trace.tool_name}</span>
      {trace.result_summary && (
        <span style={{ color: "var(--cu-500)", marginLeft: 4 }}>→ {trace.result_summary}</span>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`msg ${isUser ? "msg-user" : ""}`}>
      <div className={`msg-avatar ${isUser ? "user" : "assistant"}`}>
        {isUser ? <User size={12} /> : <Cpu size={12} />}
      </div>
      <div className="msg-body">
        {msg.tool_calls && msg.tool_calls.length > 0 && (
          <div style={{ marginBottom: "var(--sp-2)", display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
            {msg.tool_calls.map((tc, i) => <ToolCallBadge key={i} trace={tc} />)}
          </div>
        )}
        <div className={`msg-bubble ${isUser ? "user" : "assistant"}`}>
          {msg.content.split("\n").map((line, i) => (
            <p key={i} style={{ margin: i > 0 ? "var(--sp-2) 0 0" : 0 }}>
              {line.replace(/\*\*(.*?)\*\*/g, (_, m) => m)}
            </p>
          ))}
        </div>
        <div style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)", marginTop: "var(--sp-1)", paddingLeft: isUser ? 0 : "var(--sp-1)" }}>
          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

function StreamingMsg({ content, toolSteps }: { content: string; toolSteps: ToolCallTrace[] }) {
  return (
    <div className="msg">
      <div className="msg-avatar assistant"><Cpu size={12} /></div>
      <div className="msg-body">
        {toolSteps.length > 0 && (
          <div style={{ marginBottom: "var(--sp-2)", display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
            {toolSteps.map((tc, i) => <ToolCallBadge key={i} trace={tc} />)}
          </div>
        )}
        {content ? (
          <div className="msg-bubble assistant">
            {content.split("\n").map((line, i) => (
              <p key={i} style={{ margin: i > 0 ? "var(--sp-2) 0 0" : 0 }}>{line}</p>
            ))}
            <span style={{ display: "inline-block", width: 6, height: 14, background: "var(--cu-500)", marginLeft: 2, animation: "pulse 1s infinite", verticalAlign: "text-bottom", borderRadius: 1 }} />
          </div>
        ) : (
          <div className="tool-step running">
            <div className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
            Thinking…
          </div>
        )}
      </div>
    </div>
  );
}

export interface CopilotChatHandle {
  /** Programmatically ask a question (used by the docked panel's "Ask about this" affordance). */
  ask: (text: string) => void;
}

export interface CopilotChatProps {
  /** "full" shows the history rail (the /copilot workspace); "panel" is the compact docked column. */
  variant?: "full" | "panel";
  /** Page/item context sent with every message so the agent knows what the user is looking at. */
  context?: Record<string, string | number> | null;
  /** A question to send automatically once, on mount. */
  initialQuery?: string;
  /** Bump this key to start a fresh conversation from outside (e.g. a "New chat" button). */
  resetKey?: number;
}

/**
 * The complete chat engine — sessions, streaming, tool traces, input — rendered either as the
 * full workspace (`/copilot`) or as a compact docked panel on any data page. One implementation
 * so both stay in lock-step.
 */
export default function CopilotChat({ variant = "full", context, initialQuery, resetKey }: CopilotChatProps) {
  const { data: session } = useSession();
  const token = session?.backendToken;
  const isPanel = variant === "panel";

  const [sessions, setSessions]   = useState<ChatSession[]>([]);
  const [activeId, setActiveId]   = useState<string | null>(null);
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [input, setInput]         = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [toolSteps, setToolSteps] = useState<ToolCallTrace[]>([]);

  const msgsRef = useRef<HTMLDivElement>(null);
  const taRef   = useRef<HTMLTextAreaElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    if (!token || isPanel) return; // the panel keeps history out of the way
    apiClient(token).getChatSessions().then(setSessions).catch(() => setSessions([]));
  }, [token, isPanel]);

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamContent]);

  const autoResize = () => {
    const ta = taRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = `${ta.scrollHeight}px`; }
  };

  const sendMessage = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || streaming) return;

    const userMsg: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: msg,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setStreaming(true);
    setStreamContent("");
    setToolSteps([]);
    if (taRef.current) taRef.current.style.height = "auto";

    let fullContent = "";
    const collectedTools: ToolCallTrace[] = [];

    try {
      for await (const event of apiClient(token).streamChatFetch(activeId, msg, context)) {
        if (event.type === "tool") {
          const tc = JSON.parse(event.data) as ToolCallTrace;
          collectedTools.push(tc);
          setToolSteps([...collectedTools]);
        } else if (event.type === "message") {
          fullContent = event.data;
          setStreamContent(fullContent);
        }
      }
    } catch {
      fullContent = "Sorry, I couldn't reach the backend. Please check your connection.";
      setStreamContent(fullContent);
    }

    const assistantMsg: ChatMessage = {
      id: `tmp-a-${Date.now()}`,
      role: "assistant",
      content: fullContent,
      tool_calls: collectedTools,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, assistantMsg]);
    setStreaming(false);
    setStreamContent("");
    setToolSteps([]);
  }, [activeId, token, streaming, context]);

  // Fire the initial query once (e.g. arriving from an "Ask about this" button).
  useEffect(() => {
    if (initialQuery && !sentInitial.current) {
      sentInitial.current = true;
      const t = setTimeout(() => sendMessage(initialQuery), 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  // Reset to a fresh conversation when the parent bumps resetKey.
  useEffect(() => {
    if (resetKey === undefined) return;
    setActiveId(null);
    setMessages([]);
    setInput("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const welcome = (
    <div style={{ marginTop: isPanel ? "var(--sp-4)" : "var(--sp-8)" }}>
      {!isPanel && (
        <div style={{ marginBottom: "var(--sp-8)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginBottom: "var(--sp-4)" }}>
            <div style={{ width: 40, height: 40, borderRadius: "var(--r-md)", background: "var(--cu-500)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Cpu size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily: "var(--ff-display)", fontSize: "var(--ts-lg)", fontWeight: "var(--fw-bold)" }}>Inventory Copilot</div>
              <div style={{ fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)" }}>Powered by LangGraph + Gemini · Grounded on deterministic core</div>
            </div>
          </div>
          <p style={{ fontSize: "var(--ts-sm)", color: "var(--tx-secondary)", lineHeight: "var(--lh-relaxed)", maxWidth: 600 }}>
            I can answer questions about demand forecasts, inventory policy decisions, what-if scenarios,
            and data analytics. I only report numbers I computed from real tools — I will never invent a figure.
          </p>
        </div>
      )}
      <div>
        <div style={{ fontSize: "var(--ts-xs)", fontWeight: "var(--fw-semibold)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--tx-tertiary)", marginBottom: "var(--sp-3)" }}>
          Try asking
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          {(isPanel ? SUGGESTIONS.slice(0, 3) : SUGGESTIONS).map((s) => (
            <button
              key={s}
              className="btn btn-secondary"
              style={{ justifyContent: "flex-start", height: "auto", padding: "var(--sp-3) var(--sp-4)", textAlign: "left", fontWeight: "var(--fw-regular)", whiteSpace: "normal" }}
              onClick={() => sendMessage(s)}
              id={`suggestion-${s.slice(0, 20).replace(/\s/g, "-")}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const history = (
    <div className="chat-hist">
      <div className="chat-hist-hdr">
        <span className="chat-hist-title">History</span>
      </div>
      <div className="chat-hist-list">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`chat-hist-item ${activeId === s.id ? "active" : ""}`}
            onClick={() => {
              setActiveId(s.id);
              if (token) apiClient(token).getMessages(s.id).then(setMessages).catch(() => setMessages([]));
            }}
            id={`chat-session-${s.id}`}
          >
            <div className="chat-hist-item-title">{s.title ?? "Untitled conversation"}</div>
            <div className="chat-hist-item-meta">{new Date(s.created_at).toLocaleDateString()}</div>
          </div>
        ))}
        {sessions.length === 0 && (
          <div style={{ padding: "var(--sp-6) var(--sp-4)", fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)", textAlign: "center" }}>
            No conversations yet
          </div>
        )}
      </div>
      <div style={{ padding: "var(--sp-4)", borderTop: "1px solid var(--border)", fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)", lineHeight: "var(--lh-relaxed)" }}>
        <strong style={{ color: "var(--tx-secondary)", display: "block", marginBottom: "var(--sp-1)" }}>Tools available</strong>
        {TOOLS.map((t) => (
          <div key={t} className="tool-step" style={{ marginBottom: 2 }}>
            <Zap size={10} />
            <span className="mono">{t}</span>
          </div>
        ))}
        <div style={{ marginTop: "var(--sp-3)", color: "var(--tx-disabled)" }}>
          Grounding guardrail active — fabricated numbers are blocked.
        </div>
      </div>
    </div>
  );

  const main = (
    <div className="chat-main">
      <div className="chat-msgs" ref={msgsRef}>
        {messages.length === 0 && !streaming && welcome}
        {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
        {streaming && <StreamingMsg content={streamContent} toolSteps={toolSteps} />}
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrap">
          <textarea
            ref={taRef}
            className="chat-textarea"
            rows={1}
            placeholder="Ask about inventory, forecasts, what-if scenarios…"
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            disabled={streaming}
            id="copilot-input"
          />
          <button
            className="btn btn-primary btn-icon"
            style={{ flexShrink: 0 }}
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            id="copilot-send"
          >
            {streaming ? <span className="spinner" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} /> : <Send size={14} />}
          </button>
        </div>
        {!isPanel && (
          <div style={{ marginTop: "var(--sp-2)", fontSize: "var(--ts-xs)", color: "var(--tx-tertiary)", textAlign: "center" }}>
            Press <kbd style={{ background: "var(--canvas)", border: "1px solid var(--border)", borderRadius: 3, padding: "1px 5px", fontFamily: "var(--ff-mono)", fontSize: "var(--ts-2xs)" }}>Enter</kbd> to send ·{" "}
            <kbd style={{ background: "var(--canvas)", border: "1px solid var(--border)", borderRadius: 3, padding: "1px 5px", fontFamily: "var(--ff-mono)", fontSize: "var(--ts-2xs)" }}>Shift+Enter</kbd> for newline
          </div>
        )}
      </div>
    </div>
  );

  if (isPanel) return main;

  return (
    <div className="chat-shell">
      {history}
      {main}
    </div>
  );
}

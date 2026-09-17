"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, Check, Cloud, Cpu, Download, Loader2 } from "lucide-react";
import { Panel, PanelHeader } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api";
import type { LlmStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// A couple of sensible Gemini defaults; the field stays free-text so any model id works.
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"];

export function ModelSettings() {
  const { data: session } = useSession();
  const token = session?.backendToken;

  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("");
  const [applying, setApplying] = useState(false);
  const [appliedTick, setAppliedTick] = useState(false);

  const [pullName, setPullName] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullStatus, setPullStatus] = useState("");
  const [pullPct, setPullPct] = useState<number | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const s = await apiClient(token).getLlmStatus();
      setStatus(s);
      setProvider(s.provider);
      setModel(s.model);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [token]);

  useEffect(() => {
    if (token) void loadStatus();
  }, [token, loadStatus]);

  // Switching provider picks a sensible default model for that provider.
  const chooseProvider = (p: string) => {
    setProvider(p);
    if (p === "gemini") {
      setModel(status?.provider === "gemini" ? status.model : (GEMINI_MODELS[0] ?? "gemini-2.5-flash"));
    } else {
      setModel(status?.ollama_models[0]?.name ?? "");
    }
  };

  const geminiUsable = status?.gemini_configured ?? false;
  const ollamaUsable = (status?.ollama_available ?? false) && status !== null;
  const canApply =
    !!model &&
    !applying &&
    (provider === "gemini" ? geminiUsable : ollamaUsable) &&
    !(provider === status?.provider && model === status?.model);

  const apply = async () => {
    setApplying(true);
    try {
      await apiClient(token).updateLlm(provider, model);
      await loadStatus();
      setAppliedTick(true);
      setTimeout(() => setAppliedTick(false), 1800);
    } catch {
      setLoadError(true);
    } finally {
      setApplying(false);
    }
  };

  const pull = async () => {
    const name = pullName.trim();
    if (!name) return;
    setPulling(true);
    setPullError(null);
    setPullStatus("Starting");
    setPullPct(null);
    try {
      for await (const evt of apiClient(token).pullOllamaModel(name)) {
        if (evt.type === "error") {
          const { error } = JSON.parse(evt.data) as { error: string };
          setPullError(error);
          break;
        }
        if (evt.type === "progress") {
          const p = JSON.parse(evt.data) as { status?: string; completed?: number; total?: number };
          if (p.status) setPullStatus(p.status);
          setPullPct(p.total ? Math.round(((p.completed ?? 0) / p.total) * 100) : null);
        }
      }
    } catch {
      setPullError("The download failed. Check that Ollama is running.");
    } finally {
      setPulling(false);
      await loadStatus(); // pick up the newly installed model
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="AI model"
        subtitle="Choose which model powers the assistant"
        action={
          <Button size="sm" variant="outline" onClick={apply} disabled={!canApply}>
            {appliedTick ? (
              <>
                <Check className="size-3.5 text-success" /> Applied
              </>
            ) : applying ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Applying
              </>
            ) : (
              "Apply"
            )}
          </Button>
        }
      />

      {loadError ? (
        <div className="px-5 py-4 text-sm text-muted-foreground">
          Could not load the model settings. Is the backend running?
        </div>
      ) : !status ? (
        <div className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading
        </div>
      ) : (
        <div className="divide-y divide-border">
          {/* Provider */}
          <div className="px-5 py-4">
            <p className="text-sm font-medium">Provider</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Cloud (Gemini) or on-device (Ollama)
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                {
                  id: "gemini",
                  label: "Gemini",
                  Icon: Cloud,
                  sub: geminiUsable ? "Cloud API" : "No API key",
                  ok: geminiUsable,
                },
                {
                  id: "ollama",
                  label: "Ollama",
                  Icon: Cpu,
                  sub: ollamaUsable ? "On-device" : "Not detected",
                  ok: ollamaUsable,
                },
              ].map(({ id, label, Icon, sub, ok }) => (
                <button
                  key={id}
                  onClick={() => chooseProvider(id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    provider === id
                      ? "border-primary/40 bg-copper-50 text-primary"
                      : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium capitalize">{label}</span>
                    <span
                      className={cn(
                        "block text-[11px]",
                        ok ? "text-muted-foreground" : "text-danger",
                      )}
                    >
                      {sub}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div className="px-5 py-4">
            <p className="text-sm font-medium">Model</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {provider === "gemini"
                ? "A Gemini model id"
                : "An installed Ollama model (pull more below)"}
            </p>
            <div className="mt-3">
              {provider === "gemini" ? (
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  list="gemini-models"
                  placeholder="gemini-2.5-flash"
                  className="h-8 w-64 text-sm"
                />
              ) : status.ollama_available && status.ollama_models.length > 0 ? (
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="h-8 w-64 text-sm">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {status.ollama_models.map((m) => (
                      <SelectItem key={m.name} value={m.name}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AlertTriangle className="size-3.5" />
                  {status.ollama_available
                    ? "No models installed yet. Pull one below."
                    : "Ollama is not reachable. Start it, then refresh."}
                </p>
              )}
              <datalist id="gemini-models">
                {GEMINI_MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Pull a model (Ollama only) */}
          {provider === "ollama" && (
            <div className="px-5 py-4">
              <p className="text-sm font-medium">Download a model</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pull an Ollama model onto this machine (tool-calling models like qwen2.5 work
                best)
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Input
                  value={pullName}
                  onChange={(e) => setPullName(e.target.value)}
                  placeholder="qwen2.5:3b"
                  disabled={pulling || !status.ollama_available}
                  className="h-8 w-64 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={pull}
                  disabled={pulling || !pullName.trim() || !status.ollama_available}
                >
                  {pulling ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Pulling
                    </>
                  ) : (
                    <>
                      <Download className="size-3.5" /> Pull
                    </>
                  )}
                </Button>
              </div>

              {(pulling || pullError) && (
                <div className="mt-3">
                  {pullError ? (
                    <p className="flex items-center gap-1.5 text-xs text-danger">
                      <AlertTriangle className="size-3.5" /> {pullError}
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="capitalize">{pullStatus}</span>
                        {pullPct !== null && <span className="num">{pullPct}%</span>}
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${pullPct ?? 8}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

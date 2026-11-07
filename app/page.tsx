"use client";

import {
  AlertTriangle,
  Brain,
  Compass,
  Github,
  KeyRound,
  Plane,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AgentPipeline from "@/components/AgentPipeline";
import ApiKeysDialog from "@/components/ApiKeysDialog";
import DataModeBanner from "@/components/DataModeBanner";
import ApprovalPanel from "@/components/ApprovalPanel";
import Background from "@/components/Background";
import FinalPlan from "@/components/FinalPlan";
import Markdown from "@/components/Markdown";
import PromptBox from "@/components/PromptBox";
import ResultCard from "@/components/ResultCard";
import { AGENTS, SPECIALISTS, agentById, type NodeStatus } from "@/components/agents";
import {
  API_URL,
  GITHUB_URL,
  checkHealth,
  streamApproval,
  streamPlan,
  type ApiKeys,
  type InterruptPayload,
  type ServiceModes,
  type NodeId,
  type StreamEvent,
  type TravelState,
} from "@/lib/api";
import { EMPTY_KEYS, KEY_FIELDS, hasAnyKey, loadKeys, saveKeys } from "@/lib/keys";

type Phase = "idle" | "planning" | "review" | "finalizing" | "done" | "blocked" | "error";

const PLANNING_ORDER: NodeId[] = ["supervisor", ...SPECIALISTS, "itinerary_agent"];

/** Turn raw backend errors into something a user can act on. */
function friendlyError(msg: string) {
  if (/401|invalid[_ ]api[_ ]key|unauthori[sz]ed/i.test(msg))
    return `An API key was rejected (${msg.slice(0, 140)}). Check your keys under "API keys", or clear them to use dummy data.`;
  if (/429|rate limit/i.test(msg)) return `A provider rate-limited the request (${msg.slice(0, 140)}). Wait a moment and retry.`;
  return msg;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [userId, setUserId] = useState("demo_user");
  const [phase, setPhase] = useState<Phase>("idle");
  const [completed, setCompleted] = useState<NodeId[]>([]);
  const [data, setData] = useState<TravelState>({});
  const [interrupt, setInterrupt] = useState<InterruptPayload | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeys>(EMPTY_KEYS);
  const [rememberKeys, setRememberKeys] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  /** What the server provides without user keys (from /api/health) */
  const [serverModes, setServerModes] = useState<ServiceModes | null>(null);
  /** What the current plan actually used (from the stream) */
  const [runModes, setRunModes] = useState<ServiceModes | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const finalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { keys, remember } = loadKeys();
    setApiKeys(keys);
    setRememberKeys(remember);
  }, []);

  useEffect(() => {
    let alive = true;
    const ping = () =>
      checkHealth().then((h) => {
        if (!alive) return;
        setOnline(h.ok);
        if (h.modes) setServerModes(h.modes);
      });
    ping();
    const t = setInterval(ping, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (phase === "review") reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (phase === "done") finalRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase]);

  /** Shared handler for both the planning and the approval streams. */
  const handleEvent = useCallback((e: StreamEvent) => {
    switch (e.event) {
      case "start":
        setThreadId(e.data.thread_id);
        if (e.data.modes) setRunModes(e.data.modes);
        break;
      case "node":
        setCompleted((c) => (c.includes(e.data.node) ? c : [...c, e.data.node]));
        setData((d) => ({ ...d, ...e.data.data }));
        break;
      case "interrupt":
        setInterrupt(e.data.data);
        break;
      case "done":
        setData((d) => ({ ...d, ...e.data.state }));
        setInterrupt(e.data.interrupt);
        if (e.data.modes) setRunModes(e.data.modes);
        setPhase(e.data.status === "awaiting_approval" ? "review" : e.data.status === "blocked" ? "blocked" : "done");
        break;
      case "error":
        setError(friendlyError(e.data.message));
        setPhase("error");
        break;
    }
  }, []);

  const run = async (fn: (signal: AbortSignal) => Promise<void>) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await fn(ctrl.signal);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(
        (err as Error).message === "Failed to fetch"
          ? `Couldn't reach the API at ${API_URL}. Is the FastAPI server running?`
          : friendlyError((err as Error).message),
      );
      setPhase("error");
    }
  };

  const startPlanning = () => {
    const q = query.trim();
    if (!q) return;
    setSubmittedQuery(q);
    setPhase("planning");
    setCompleted([]);
    setData({});
    setInterrupt(null);
    setThreadId(null);
    setError(null);
    setRunModes(null);
    run((signal) => streamPlan({ query: q, user_id: userId || "demo_user", api_keys: apiKeys }, handleEvent, signal));
  };

  const decide = (approved: boolean, feedback: string) => {
    if (!threadId) return;
    setPhase("finalizing");
    setCompleted((c) => [...c, "human_approval"]);
    run((signal) => streamApproval(threadId, { approved, feedback, api_keys: apiKeys }, handleEvent, signal));
  };

  const reset = () => {
    abortRef.current?.abort();
    setPhase("idle");
    setQuery("");
    setSubmittedQuery("");
    setCompleted([]);
    setData({});
    setInterrupt(null);
    setThreadId(null);
    setError(null);
    setRunModes(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const statuses = useMemo(() => {
    const selected = data.selected_agents;
    const s = {} as Record<NodeId, NodeStatus>;
    for (const a of AGENTS) {
      if (completed.includes(a.id)) s[a.id] = "done";
      else if (SPECIALISTS.includes(a.id) && completed.includes("supervisor") && !(selected || []).includes(a.id))
        s[a.id] = "skipped";
      else s[a.id] = "pending";
    }
    if (phase === "planning") {
      const next = PLANNING_ORDER.find((id) => s[id] === "pending");
      if (next) s[next] = "running";
    } else if (phase === "review") {
      s.human_approval = "waiting";
    } else if (phase === "finalizing") {
      s.final_response = "running";
    } else if (phase === "blocked") {
      for (const a of AGENTS) if (s[a.id] === "pending") s[a.id] = "skipped";
    }
    return s;
  }, [completed, data.selected_agents, phase]);

  const visibleSpecialists = completed.includes("supervisor")
    ? SPECIALISTS.filter((id) => statuses[id] !== "skipped")
    : [];
  const busy = phase === "planning" || phase === "finalizing";

  /** What the next plan will use: a user key makes a service live, otherwise the server decides. */
  const previewModes = useMemo<ServiceModes | null>(() => {
    if (!serverModes && !hasAnyKey(apiKeys)) return null;
    const m = { ...(serverModes || { llm: "mock", flights: "mock", hotels: "mock", weather: "mock" }) } as ServiceModes;
    for (const f of KEY_FIELDS) if (apiKeys[f.id].trim()) m[f.service] = "live";
    return m;
  }, [serverModes, apiKeys]);
  const keyCount = KEY_FIELDS.filter((f) => apiKeys[f.id].trim()).length;
  const openKeys = useCallback(() => setKeysOpen(true), []);
  const closeKeys = useCallback(() => setKeysOpen(false), []);
  const constraints = Object.entries(data.trip_constraints || {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length),
  );

  return (
    <main className="relative">
      <Background />

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <button onClick={reset} className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-400 shadow-lg shadow-fuchsia-500/30">
              <Compass className="h-5 w-5 text-white" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              Voy<span className="text-gradient">agent</span>
            </span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <label className="hidden items-center gap-2 text-xs text-slate-400 lg:flex">
              User
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                disabled={busy}
                className="w-28 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-200 focus:border-fuchsia-400/50 focus:outline-none"
              />
            </label>
            <span className="chip" title={API_URL}>
              <span
                className={`h-2 w-2 rounded-full ${
                  online === null ? "bg-slate-500" : online ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-rose-500"
                }`}
              />
              <span className="hidden sm:inline">{online === null ? "Connecting" : online ? "API online" : "API offline"}</span>
            </span>
            <button
              onClick={openKeys}
              className={`chip transition hover:border-fuchsia-400/40 hover:text-white ${
                keyCount ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : ""
              }`}
              title="Add your own API keys (optional)"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">API keys</span>
              {keyCount > 0 && <span className="rounded-full bg-emerald-400/20 px-1.5 text-[10px] font-semibold">{keyCount}</span>}
            </button>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="chip transition hover:border-white/30 hover:text-white"
              title="View the source code on GitHub"
            >
              <Github className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </div>
      </header>

      {phase === "idle" ? (
        /* ---------------- Hero ---------------- */
        <section className="mx-auto flex min-h-[calc(100vh-61px)] max-w-4xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
          <span className="chip mb-6 animate-rise border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200">
            <Sparkles className="h-3.5 w-3.5" /> Multi-agent AI · LangGraph + MCP
          </span>
          <h1
            className="animate-rise font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl"
            style={{ animationDelay: "80ms" }}
          >
            Plan the trip.
            <br />
            <span className="text-gradient">Let agents do the legwork.</span>
          </h1>
          <p
            className="mt-6 max-w-2xl animate-rise text-base text-slate-400 sm:text-lg"
            style={{ animationDelay: "160ms" }}
          >
            A supervisor AI assembles a crew of specialists — flights, hotels, weather and budget — drafts your
            itinerary, and waits for your sign-off before finalizing.
          </p>

          <div className="mt-10 w-full animate-rise" style={{ animationDelay: "240ms" }}>
            <PromptBox value={query} onChange={setQuery} onSubmit={startPlanning} busy={busy} />
          </div>

          <div className="mt-6 w-full">
            <DataModeBanner modes={previewModes} onAddKeys={openKeys} context="preview" />
          </div>

          <div
            className="mt-14 grid w-full animate-rise grid-cols-1 gap-3 sm:grid-cols-3"
            style={{ animationDelay: "320ms" }}
          >
            {[
              { icon: Users, title: "8 agents", text: "Supervisor-routed specialists" },
              { icon: ShieldAlert, title: "Guardrails", text: "Off-topic requests filtered" },
              { icon: Zap, title: "Live streaming", text: "See every agent as it works" },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="glass flex items-center gap-3 px-4 py-4 text-left">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/5">
                  <Icon className="h-5 w-5 text-fuchsia-300" />
                </span>
                <div>
                  <div className="font-display font-semibold">{title}</div>
                  <div className="text-xs text-slate-400">{text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        /* ---------------- Workspace ---------------- */
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
          {/* Request summary */}
          <section className="glass flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-w-0 items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-violet-500">
                <Plane className="h-5 w-5 -rotate-12 text-white" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Your request</p>
                <p className="mt-1 text-base text-white sm:text-lg">{submittedQuery}</p>
                {threadId && <p className="mt-1 font-mono text-[11px] text-slate-500">thread · {threadId}</p>}
              </div>
            </div>
            <button className="btn-ghost shrink-0 px-4 py-2.5 text-sm" onClick={reset}>
              <RotateCcw className="h-4 w-4" /> New trip
            </button>
          </section>

          <DataModeBanner modes={runModes} onAddKeys={openKeys} context="result" />

          <AgentPipeline statuses={statuses} />

          {/* Errors / guardrail */}
          {phase === "error" && error && (
            <section className="glass flex items-start gap-4 border-rose-500/30 bg-rose-500/[0.06] p-5 animate-rise">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
              <div className="flex-1">
                <h3 className="font-display font-semibold text-rose-200">Something went wrong</h3>
                <p className="mt-1 break-words text-sm text-rose-200/80">{error}</p>
              </div>
              <button className="btn-ghost px-4 py-2 text-sm" onClick={startPlanning}>
                Retry
              </button>
            </section>
          )}

          {phase === "blocked" && (
            <section className="glass flex items-start gap-4 border-amber-500/30 bg-amber-500/[0.06] p-6 animate-rise">
              <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" />
              <div>
                <h3 className="font-display text-lg font-semibold text-amber-100">Guardrail stopped this request</h3>
                <p className="mt-1 text-sm text-amber-100/80">
                  {data.supervisor_reasoning || data.final_response || "This doesn't look like a travel planning request."}
                </p>
                <button className="btn-primary mt-4 px-4 py-2.5 text-sm" onClick={reset}>
                  Try another request
                </button>
              </div>
            </section>
          )}

          {/* Supervisor plan */}
          {phase !== "blocked" && (data.supervisor_reasoning || statuses.supervisor === "running") && (
            <section className="glass relative overflow-hidden p-5 animate-rise sm:p-6">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-violet-400 to-indigo-500 opacity-70" />
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-indigo-500">
                  <Brain className="h-[18px] w-[18px] text-white" />
                </span>
                <h3 className="font-display font-semibold">Supervisor&apos;s game plan</h3>
              </div>
              {data.supervisor_reasoning ? (
                <>
                  <Markdown className="mt-4">{data.supervisor_reasoning}</Markdown>
                  {(constraints.length > 0 || (data.selected_agents || []).length > 0) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {constraints.map(([k, v]) => (
                        <span key={k} className="chip">
                          <span className="capitalize text-slate-500">{k.replace(/_/g, " ")}</span>
                          <span className="text-slate-100">{Array.isArray(v) ? v.join(", ") : String(v)}</span>
                        </span>
                      ))}
                      {(data.selected_agents || []).map((id) => {
                        const a = agentById(id);
                        return a ? (
                          <span key={id} className="chip border-violet-400/30 bg-violet-500/10 text-violet-200">
                            <a.icon className="h-3 w-3" /> {a.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-4 w-1/2" />
                </div>
              )}
            </section>
          )}

          {/* Specialist results */}
          {visibleSpecialists.length > 0 && (
            <div className="grid gap-5 md:grid-cols-2">
              {visibleSpecialists.map((id, i) => {
                const agent = agentById(id)!;
                return (
                  <ResultCard
                    key={id}
                    agent={agent}
                    status={statuses[id]}
                    content={agent.field ? (data[agent.field] as string | undefined) : undefined}
                    delay={i * 80}
                    dummy={!!agent.service && runModes?.[agent.service] === "mock"}
                  />
                );
              })}
            </div>
          )}

          {/* Itinerary drafting placeholder */}
          {statuses.itinerary_agent === "running" && (
            <ResultCard agent={agentById("itinerary_agent")!} status="running" />
          )}

          {/* Human approval */}
          <div ref={reviewRef} className="scroll-mt-24">
            {(phase === "review" || (phase === "finalizing" && !data.final_response)) && (
              <ApprovalPanel
                draft={interrupt?.draft_itinerary || data.itinerary || ""}
                note={interrupt?.question}
                busy={phase === "finalizing"}
                onDecision={decide}
              />
            )}
          </div>

          {phase === "finalizing" && (
            <ResultCard agent={agentById("final_response")!} status="running" />
          )}

          {/* Final */}
          <div ref={finalRef} className="scroll-mt-24">
            {phase === "done" && data.final_response && <FinalPlan content={data.final_response} onReset={reset} dummy={runModes?.llm === "mock"} />}
          </div>
        </div>
      )}

      <footer className="flex flex-col items-center gap-2 pb-10 pt-6 text-center text-xs text-slate-600">
        <span>Built with Next.js · FastAPI · LangGraph · MCP</span>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-slate-500 transition hover:text-white">
          <Github className="h-3.5 w-3.5" /> View source on GitHub
        </a>
      </footer>

      <ApiKeysDialog
        open={keysOpen}
        initialKeys={apiKeys}
        initialRemember={rememberKeys}
        onClose={closeKeys}
        onSave={(keys, remember) => {
          setApiKeys(keys);
          setRememberKeys(remember);
          saveKeys(keys, remember);
          setKeysOpen(false);
        }}
      />
    </main>
  );
}

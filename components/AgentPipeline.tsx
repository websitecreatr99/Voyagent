import { Check, Loader2, Minus, Hourglass } from "lucide-react";
import type { NodeId } from "@/lib/api";
import { AGENTS, type NodeStatus } from "./agents";

const STATUS_LABEL: Record<NodeStatus, string> = {
  pending: "Queued",
  running: "Working…",
  done: "Done",
  skipped: "Not needed",
  waiting: "Needs you",
};

export default function AgentPipeline({ statuses }: { statuses: Record<NodeId, NodeStatus> }) {
  const doneCount = AGENTS.filter((a) => statuses[a.id] === "done" || statuses[a.id] === "skipped").length;
  const progress = Math.round((doneCount / AGENTS.length) * 100);

  return (
    <section className="glass p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Agent crew</h2>
          <p className="text-sm text-slate-400">Watch your planners collaborate in real time</p>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-bold text-gradient">{progress}%</div>
        </div>
      </div>

      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#8b5cf6,#ec4899,#fb923c,#8b5cf6)] bg-[length:200%_100%] animate-flow transition-[width] duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {AGENTS.map((agent, i) => {
          const status = statuses[agent.id];
          const Icon = agent.icon;
          const active = status === "running" || status === "waiting";
          return (
            <li
              key={agent.id}
              className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-500 ${
                active
                  ? "border-white/30 bg-white/[0.08] shadow-[0_0_40px_-10px_rgba(217,70,239,0.6)]"
                  : status === "done"
                  ? "border-white/10 bg-white/[0.04]"
                  : "border-white/5 bg-white/[0.02]"
              } ${status === "skipped" ? "opacity-40" : ""}`}
            >
              {active && (
                <span
                  className={`absolute inset-0 -z-0 animate-pulse bg-gradient-to-br ${agent.accent} opacity-[0.12]`}
                />
              )}
              <div className="relative flex items-start justify-between">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${agent.accent} shadow-lg ${
                    status === "pending" || status === "skipped" ? "grayscale" : ""
                  }`}
                >
                  <Icon className="h-5 w-5 text-white" />
                </span>
                <StatusDot status={status} />
              </div>
              <div className="relative mt-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] font-medium text-slate-500">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-display font-semibold">{agent.name}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{agent.blurb}</p>
                <p
                  className={`mt-2 text-[11px] font-medium uppercase tracking-wider ${
                    status === "running"
                      ? "text-fuchsia-300"
                      : status === "waiting"
                      ? "text-amber-300"
                      : status === "done"
                      ? "text-emerald-300"
                      : "text-slate-500"
                  }`}
                >
                  {STATUS_LABEL[status]}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function StatusDot({ status }: { status: NodeStatus }) {
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-fuchsia-300" />;
  if (status === "waiting") return <Hourglass className="h-4 w-4 animate-pulse text-amber-300" />;
  if (status === "done")
    return (
      <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-400/20">
        <Check className="h-3 w-3 text-emerald-300" />
      </span>
    );
  if (status === "skipped") return <Minus className="h-4 w-4 text-slate-500" />;
  return <span className="mt-1 h-2 w-2 rounded-full bg-slate-600" />;
}

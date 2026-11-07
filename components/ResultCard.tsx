"use client";

import { ChevronDown, FlaskConical } from "lucide-react";
import { useState } from "react";
import Markdown from "./Markdown";
import type { AgentMeta, NodeStatus } from "./agents";

export default function ResultCard({
  agent,
  status,
  content,
  delay = 0,
  dummy = false,
}: {
  agent: AgentMeta;
  status: NodeStatus;
  content?: string;
  delay?: number;
  /** Output is dummy data (no API key for this service) */
  dummy?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = agent.icon;
  const loading = status === "running" || (status === "pending" && !content);

  return (
    <article className="glass group relative flex flex-col overflow-hidden animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${agent.accent} opacity-70`} />
      <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${agent.accent}`}>
          <Icon className="h-[18px] w-[18px] text-white" />
        </span>
        <div className="flex-1">
          <h3 className="font-display font-semibold">{agent.name}</h3>
          <p className="text-xs text-slate-400">{agent.blurb}</p>
        </div>
        {dummy && (
          <span className="chip border-amber-400/30 bg-amber-500/10 text-amber-200" title="No API key for this service: showing sample output">
            <FlaskConical className="h-3 w-3" /> Dummy data
          </span>
        )}
        {status === "running" && <span className="chip border-fuchsia-400/30 text-fuchsia-200">Working</span>}
      </header>

      <div
        className={`scroll-thin relative px-5 py-4 transition-[max-height] duration-500 ${
          expanded ? "max-h-[2000px]" : "max-h-72 overflow-hidden"
        }`}
      >
        {loading ? (
          <div className="space-y-3">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-5/6" />
            <div className="skeleton h-4 w-2/3" />
          </div>
        ) : content ? (
          <Markdown>{content}</Markdown>
        ) : (
          <p className="text-sm text-slate-500">No results.</p>
        )}
        {!expanded && content && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-900/95 to-transparent" />
        )}
      </div>

      {content && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center justify-center gap-1 border-t border-white/5 py-2.5 text-xs font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          {expanded ? "Show less" : "Show more"}
          <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </article>
  );
}

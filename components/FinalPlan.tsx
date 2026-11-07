"use client";

import { Check, Copy, Download, FlaskConical, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import Markdown from "./Markdown";

export default function FinalPlan({
  content,
  onReset,
  dummy = false,
}: {
  content: string;
  onReset: () => void;
  /** Plan was written without an LLM key (sample output) */
  dummy?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const download = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "travel-plan.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="relative animate-rise rounded-[32px] p-[1.5px]">
      <div className="absolute inset-0 rounded-[32px] bg-[linear-gradient(120deg,#f472b6,#a78bfa,#38bdf8,#fbbf24,#f472b6)] bg-[length:200%_100%] animate-flow" />
      <div className="relative overflow-hidden rounded-[31px] bg-ink-900">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />

        <header className="relative flex flex-col gap-4 border-b border-white/10 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-orange-300 to-pink-500 shadow-lg shadow-pink-500/30">
              <Sparkles className="h-6 w-6 text-white" />
            </span>
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-pink-300">
                Ready for takeoff
                {dummy && (
                  <span className="chip border-amber-400/30 bg-amber-500/10 normal-case tracking-normal text-amber-200">
                    <FlaskConical className="h-3 w-3" /> Dummy data
                  </span>
                )}
              </p>
              <h2 className="font-display text-2xl font-bold sm:text-3xl">Your final travel plan</h2>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost px-4 py-2.5 text-sm" onClick={copy}>
              {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button className="btn-ghost px-4 py-2.5 text-sm" onClick={download}>
              <Download className="h-4 w-4" /> .md
            </button>
            <button className="btn-primary px-4 py-2.5 text-sm" onClick={onReset}>
              <RotateCcw className="h-4 w-4" /> New trip
            </button>
          </div>
        </header>

        <div className="relative px-6 py-8 sm:px-10">
          <Markdown className="prose-base">{content}</Markdown>
        </div>
      </div>
    </section>
  );
}

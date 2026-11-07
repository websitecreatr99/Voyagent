"use client";

import { CheckCircle2, Loader2, PencilLine, Send, UserCheck } from "lucide-react";
import { useState } from "react";
import Markdown from "./Markdown";

export default function ApprovalPanel({
  draft,
  note,
  busy,
  onDecision,
}: {
  draft: string;
  note?: string;
  busy: boolean;
  onDecision: (approved: boolean, feedback: string) => void;
}) {
  const [mode, setMode] = useState<"choose" | "revise">("choose");
  const [feedback, setFeedback] = useState("");

  return (
    <section className="glass-strong relative overflow-hidden animate-rise">
      <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl" />
      <div className="relative border-b border-white/10 px-6 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-yellow-300 to-amber-500 shadow-lg shadow-amber-500/30">
            <UserCheck className="h-5 w-5 text-ink-950" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Your turn</p>
            <h2 className="font-display text-xl font-semibold sm:text-2xl">Review the draft itinerary</h2>
          </div>
        </div>
        {note && <p className="mt-3 max-w-3xl text-sm text-slate-400">{note}</p>}
      </div>

      <div className="scroll-thin relative max-h-[560px] overflow-y-auto px-6 py-6 sm:px-8">
        <Markdown className="prose-base">{draft || "_The itinerary agent returned an empty draft._"}</Markdown>
      </div>

      <div className="relative border-t border-white/10 bg-black/20 px-6 py-5 sm:px-8">
        {mode === "choose" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-300">Happy with this plan, or should the agents rework it?</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button className="btn-ghost" disabled={busy} onClick={() => setMode("revise")}>
                <PencilLine className="h-4 w-4" /> Request changes
              </button>
              <button className="btn-primary" disabled={busy} onClick={() => onDecision(true, "")}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Approve & finalize
              </button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (feedback.trim()) onDecision(false, feedback.trim());
            }}
          >
            <label htmlFor="feedback" className="text-sm font-medium text-slate-200">
              What should change?
            </label>
            <textarea
              id="feedback"
              autoFocus
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              placeholder="e.g. Swap day 3 for Nara, add a ryokan stay, keep total under ₹1.8 lakh…"
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-fuchsia-400/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20"
              disabled={busy}
            />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setMode("choose")}>
                Back
              </button>
              <button type="submit" className="btn-primary" disabled={busy || !feedback.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send feedback
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

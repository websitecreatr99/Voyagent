"use client";

import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useRef } from "react";

const EXAMPLES = [
  "Plan a 7-day Japan trip from Delhi under ₹2 lakh, budget hotels, no overnight flights.",
  "Romantic 5 days in Bali in December for two, mid-range stays.",
  "Weekend in Goa from Mumbai for 4 friends under ₹40k.",
  "10-day Switzerland & Italy rail trip in June, scenic routes.",
];

export default function PromptBox({
  value,
  onChange,
  onSubmit,
  busy,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  compact?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && value.trim()) onSubmit();
        }}
        className="group relative rounded-[28px] p-[1.5px] transition"
      >
        {/* Animated gradient border */}
        <div className="absolute inset-0 rounded-[28px] bg-[linear-gradient(90deg,#8b5cf6,#38bdf8,#ec4899,#fb923c,#8b5cf6)] bg-[length:200%_100%] opacity-60 blur-[2px] transition group-focus-within:opacity-100 animate-flow" />
        <div className="relative flex flex-col gap-3 rounded-[27px] bg-ink-900/95 p-3 sm:flex-row sm:items-end sm:p-4">
          <Sparkles className="ml-1 hidden h-5 w-5 shrink-0 text-fuchsia-300 sm:mb-3 sm:block" />
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!busy && value.trim()) onSubmit();
              }
            }}
            rows={compact ? 1 : 2}
            placeholder="Where do you want to go? Dates, budget, vibe…"
            className="min-h-[52px] flex-1 resize-none bg-transparent px-2 py-2.5 text-base text-white placeholder:text-slate-500 focus:outline-none sm:text-lg"
            disabled={busy}
          />
          <button type="submit" className="btn-primary shrink-0" disabled={busy || !value.trim()}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Planning
              </>
            ) : (
              <>
                Plan my trip <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {!compact && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={busy}
              onClick={() => {
                onChange(ex);
                ref.current?.focus();
              }}
              className="chip max-w-full truncate transition hover:border-fuchsia-400/40 hover:bg-fuchsia-500/10 hover:text-white disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

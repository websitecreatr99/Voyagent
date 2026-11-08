import { FlaskConical, KeyRound, Radio } from "lucide-react";
import type { ServiceId, ServiceModes } from "@/lib/api";
import { SERVICE_LABEL } from "@/lib/keys";

const TOTAL_KEYS = 4;

/**
 * Tells the user whether results are real or dummy data, and how to get real ones.
 * All-or-nothing: the planner runs live only when all four API keys are available.
 */
export default function DataModeBanner({
  modes,
  missing,
  onAddKeys,
  context,
}: {
  modes?: ServiceModes | null;
  /** Services that still have no key (from the user or the server) */
  missing: ServiceId[];
  onAddKeys: () => void;
  /** "preview" = what the next plan will use; "result" = what this plan used */
  context: "preview" | "result";
}) {
  if (!modes) return null;
  const anyMock = Object.values(modes).some((m) => m === "mock");

  if (!anyMock) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-2.5 text-sm text-emerald-100/90 animate-rise">
        <Radio className="h-4 w-4 shrink-0 text-emerald-300" />
        {context === "result" ? "This plan used live data from all services." : "All 4 API keys added: you'll get real results."}
      </div>
    );
  }

  const added = TOTAL_KEYS - missing.length;
  const title =
    context === "result"
      ? "This plan uses dummy data"
      : added === 0
      ? "Demo mode: results will be dummy data"
      : `Dummy data until all 4 API keys are added (${added} of ${TOTAL_KEYS} added)`;
  const body =
    added === 0 || missing.length === 0
      ? "Every agent returns sample output. To actually use the planner, add all 4 API keys (Groq, AviationStack, Tavily and OpenWeather)."
      : `The planner needs all 4 API keys to run live. Still missing: ${missing.map((s) => SERVICE_LABEL[s]).join(", ")}.`;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/[0.07] px-4 py-3.5 text-left animate-rise sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div>
          <p className="text-sm font-semibold text-amber-100">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-100/70">{body}</p>
        </div>
      </div>
      <button onClick={onAddKeys} className="btn-ghost shrink-0 border-amber-300/30 px-4 py-2 text-sm text-amber-50 hover:border-amber-200/50 hover:bg-amber-400/10">
        <KeyRound className="h-4 w-4" /> {added > 0 ? "Add missing keys" : "Add API keys"}
      </button>
    </div>
  );
}

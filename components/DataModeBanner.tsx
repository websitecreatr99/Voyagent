import { FlaskConical, KeyRound, Radio } from "lucide-react";
import type { ServiceId, ServiceModes } from "@/lib/api";
import { SERVICE_LABEL } from "@/lib/keys";

/** Tells the user whether results are real or dummy data, and how to get real ones. */
export default function DataModeBanner({
  modes,
  onAddKeys,
  context,
}: {
  modes?: ServiceModes | null;
  onAddKeys: () => void;
  /** "preview" = what the next plan will use; "result" = what this plan used */
  context: "preview" | "result";
}) {
  if (!modes) return null;
  const mock = (Object.keys(modes) as ServiceId[]).filter((s) => modes[s] === "mock");

  if (mock.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-2.5 text-sm text-emerald-100/90 animate-rise">
        <Radio className="h-4 w-4 shrink-0 text-emerald-300" />
        {context === "result" ? "This plan used live data from all services." : "All services are live: you'll get real results."}
      </div>
    );
  }

  const all = mock.length === Object.keys(modes).length;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/[0.07] px-4 py-3.5 text-left animate-rise sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div>
          <p className="text-sm font-semibold text-amber-100">
            {all
              ? context === "result"
                ? "This plan uses dummy data"
                : "Demo mode: results will be dummy data"
              : context === "result"
              ? "Part of this plan uses dummy data"
              : "Some results will be dummy data"}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-100/70">
            {all
              ? "No API keys are configured, so every agent returns sample output. To actually use the planner, add your API keys."
              : `Dummy data for: ${mock.map((s) => SERVICE_LABEL[s]).join(", ")}. Add those keys to get real results.`}
          </p>
        </div>
      </div>
      <button onClick={onAddKeys} className="btn-ghost shrink-0 border-amber-300/30 px-4 py-2 text-sm text-amber-50 hover:border-amber-200/50 hover:bg-amber-400/10">
        <KeyRound className="h-4 w-4" /> Add API keys
      </button>
    </div>
  );
}

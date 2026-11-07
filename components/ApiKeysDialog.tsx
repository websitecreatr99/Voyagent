"use client";

import { Check, ExternalLink, Eye, EyeOff, KeyRound, ShieldCheck, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ApiKeys } from "@/lib/api";
import { EMPTY_KEYS, KEY_FIELDS } from "@/lib/keys";

export default function ApiKeysDialog({
  open,
  initialKeys,
  initialRemember,
  onClose,
  onSave,
}: {
  open: boolean;
  initialKeys: ApiKeys;
  initialRemember: boolean;
  onClose: () => void;
  onSave: (keys: ApiKeys, remember: boolean) => void;
}) {
  const [keys, setKeys] = useState<ApiKeys>(initialKeys);
  const [remember, setRemember] = useState(initialRemember);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setKeys(initialKeys);
    setRemember(initialRemember);
    setVisible({});
    setTimeout(() => firstInput.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, initialKeys, initialRemember, onClose]);

  if (!open) return null;

  const filled = KEY_FIELDS.filter((f) => keys[f.id].trim()).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="keys-title">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-strong relative max-h-[92vh] w-full max-w-xl animate-rise overflow-y-auto rounded-b-none sm:rounded-3xl">
        <header className="flex items-start gap-3 border-b border-white/10 px-6 py-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-fuchsia-500/30">
            <KeyRound className="h-5 w-5 text-white" />
          </span>
          <div className="flex-1">
            <h2 id="keys-title" className="font-display text-xl font-semibold">
              Your API keys <span className="text-sm font-normal text-slate-400">(optional)</span>
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Add any keys you have. Each one switches its part of the plan from dummy data to real results.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </header>

        <form
          className="space-y-4 px-6 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(keys, remember);
          }}
        >
          {KEY_FIELDS.map((f, i) => {
            const show = visible[f.id];
            const has = !!keys[f.id].trim();
            return (
              <div key={f.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <label htmlFor={`key-${f.id}`} className="text-sm font-medium text-slate-200">
                    {f.label}
                    {has && <Check className="ml-1.5 inline h-3.5 w-3.5 text-emerald-300" />}
                  </label>
                  <a href={f.getUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200">
                    Get a key <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="relative">
                  <input
                    ref={i === 0 ? firstInput : undefined}
                    id={`key-${f.id}`}
                    type={show ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    value={keys[f.id]}
                    onChange={(e) => setKeys((k) => ({ ...k, [f.id]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-3 pr-10 font-mono text-sm text-white placeholder:font-sans placeholder:text-slate-500 focus:border-fuchsia-400/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setVisible((v) => ({ ...v, [f.id]: !v[f.id] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-white"
                    aria-label={show ? `Hide ${f.label} key` : `Show ${f.label} key`}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">{f.powers}</p>
              </div>
            );
          })}

          <label className="flex cursor-pointer items-center gap-2.5 pt-1 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/5 accent-fuchsia-500"
            />
            Remember on this device
          </label>

          <div className="flex gap-2.5 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-3 text-xs leading-relaxed text-emerald-100/80">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <p>
              Keys are sent over HTTPS to the backend only for your requests. They aren't stored on the server or written to logs.
              In this browser they're kept {remember ? "on this device until you clear them" : "only until you close this tab"}.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              className="btn-ghost px-4 py-2.5 text-sm"
              onClick={() => {
                setKeys(EMPTY_KEYS);
                onSave(EMPTY_KEYS, false);
              }}
            >
              <Trash2 className="h-4 w-4" /> Clear all
            </button>
            <button type="submit" className="btn-primary px-5 py-2.5 text-sm">
              <Check className="h-4 w-4" /> Save {filled ? `${filled} key${filled > 1 ? "s" : ""}` : "(use dummy data)"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

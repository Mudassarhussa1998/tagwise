"use client";

import { useEffect, useState } from "react";
import { CircleAlert, ClipboardCheck, RefreshCw, Wrench } from "lucide-react";
import { cn } from "@/components/ui";

function useTicker(steps: number, ms: number, start = 0) {
  const [step, setStep] = useState(start);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setStep((s) => (s + 1) % steps), ms);
    return () => clearInterval(id);
  }, [steps, ms]);
  return step;
}

const FEED = [
  { code: "FL-08", text: "Control passed", by: "Bilal", tone: "ok", icon: ClipboardCheck },
  { code: "MX-12", text: "Failure reported: oil leak", by: "Hamza", tone: "danger", icon: CircleAlert },
  { code: "CR-04", text: "Preventive maintenance done", by: "Sara", tone: "ok", icon: Wrench },
  { code: "GN-02", text: "Control failed (1 of 4)", by: "Usman", tone: "warn", icon: CircleAlert },
  { code: "MX-12", text: "Back in operation", by: "Mechanic", tone: "ok", icon: RefreshCw },
  { code: "FL-21", text: "Control passed", by: "Ali", tone: "ok", icon: ClipboardCheck },
] as const;

const TONE = {
  ok: "bg-emerald-100 text-emerald-700",
  warn: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
};

/** Dashboard mock where field events keep arriving at the top. */
export function LiveFeed() {
  const tick = useTicker(FEED.length * 100, 2200, 3); // start with a full list
  const visible = Array.from({ length: 4 }, (_, i) => {
    const n = tick - i;
    return n >= 0 ? { ...FEED[n % FEED.length], key: n } : null;
  }).filter((e) => e !== null);
  const minutes = ["just now", "1 min ago", "3 min ago", "6 min ago"];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.25)] sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Live activity</p>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>
      </div>
      <ul className="mt-4 space-y-2.5">
        {visible.map((e, i) => {
          const Icon = e.icon;
          return (
            <li key={e.key} className={cn("flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5", i === 0 && "animate-slide-in")}>
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", TONE[e.tone])}>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-900">
                  <span className="mr-1.5 font-mono text-[11px] font-semibold text-primary-600">{e.code}</span>
                  {e.text}
                </p>
                <p className="text-[11px] text-slate-500">
                  {e.by} · {minutes[i]}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

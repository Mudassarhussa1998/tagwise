"use client";

import { useEffect, useState } from "react";
import { BellRing, Camera, Check, CircleAlert, ClipboardCheck, LayoutDashboard, RefreshCw, Wrench, X } from "lucide-react";
import { cn } from "@/components/ui";

const ITEMS = [
  { q: "Forks and chains in good condition", ok: true },
  { q: "No hydraulic leaks", ok: false },
  { q: "Horn and lights work", ok: true },
  { q: "Brakes respond correctly", ok: true },
];

// 0-4: items answered one by one · 5: photo · 6: submit pressed · 7-9: result shown · then loop
const STEPS = 10;

function useTicker(steps: number, ms: number, start = 0) {
  const [step, setStep] = useState(start);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setStep((s) => (s + 1) % steps), ms);
    return () => clearInterval(id);
  }, [steps, ms]);
  return step;
}

/** Animated phone: an operator scans FL-08, answers the checklist, attaches a photo and reports the leak. */
export function HeroPhone() {
  const step = useTicker(STEPS, 1000);
  const answered = Math.min(step, ITEMS.length);
  const photo = step >= 5;
  const submitted = step >= 7;

  return (
    <div className="relative mx-auto w-full max-w-[330px]">
      <div className="absolute -inset-10 -z-10 rounded-full bg-gradient-to-br from-primary-500/25 via-sky-300/20 to-transparent blur-3xl" />

      <div className="rounded-[2.4rem] border border-slate-200 bg-white p-2.5 shadow-[0_30px_80px_-20px_rgba(37,99,235,0.35)]">
        <div className="relative overflow-hidden rounded-[1.9rem] bg-slate-50 px-3.5 pb-4 pt-6">
          <div className="absolute left-1/2 top-2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-slate-200" />
          <p className="text-center text-[10px] font-medium uppercase tracking-widest text-slate-400">Demo Industries</p>

          <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[11px] font-semibold text-primary-600">FL-08</p>
                <p className="text-sm font-semibold text-slate-900">Toyota forklift</p>
                <p className="text-[11px] text-slate-500">Central warehouse</p>
              </div>
              <span
                key={submitted ? "attention" : "ok"}
                className={cn(
                  "animate-pop rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                  submitted ? "bg-amber-50 text-amber-800 ring-amber-600/25" : "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
                )}
              >
                {submitted ? "Needs attention" : "Operational"}
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {ITEMS.map((item, i) => {
              const done = i < answered;
              return (
                <div
                  key={item.q}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-[12px] text-slate-700 transition-colors duration-300",
                    done && !item.ok ? "border-red-200" : "border-slate-200",
                  )}
                >
                  <span className="truncate">{item.q}</span>
                  {done ? (
                    <span
                      className={cn(
                        "animate-pop flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                        item.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
                      )}
                    >
                      {item.ok ? <Check className="size-3" /> : <X className="size-3" />}
                      {item.ok ? "OK" : "Not OK"}
                    </span>
                  ) : (
                    <span className="h-4 w-10 shrink-0 rounded-md bg-slate-100" />
                  )}
                </div>
              );
            })}
          </div>

          <div
            className={cn(
              "mt-2 flex items-center justify-center gap-1.5 rounded-xl border border-dashed py-2 text-[11px] transition-colors duration-300",
              photo ? "border-primary-300 bg-primary-50 text-primary-700" : "border-slate-300 text-slate-500",
            )}
          >
            <Camera className="size-3.5" /> {photo ? "Photo attached" : "Add photo"}
          </div>

          <div
            className={cn(
              "mt-2 rounded-xl py-2.5 text-center text-[12px] font-semibold text-white transition-all duration-300",
              step === 6 ? "scale-[0.97] bg-red-700" : answered === ITEMS.length ? "bg-red-600" : "bg-slate-300",
            )}
          >
            {step === 6 ? "Sending…" : "Submit and report issue"}
          </div>

          {submitted && (
            <div className="animate-slide-in absolute inset-x-3 bottom-3 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                <BellRing className="size-4" />
              </span>
              <span className="text-[11px] leading-tight">
                <span className="block font-semibold text-slate-900">Issue reported</span>
                <span className="text-slate-500">Supervisor notified instantly</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Floating context cards (desktop) */}
      <div className="animate-float absolute -left-40 top-44 hidden w-48 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur xl:block">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
          <LayoutDashboard className="size-3.5 text-primary-600" /> Live dashboard
        </div>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="bg-emerald-500 transition-all duration-700" style={{ width: submitted ? "75%" : "100%" }} />
          <div className="bg-amber-400 transition-all duration-700" style={{ width: submitted ? "25%" : "0%" }} />
        </div>
        <p className="mt-1.5 text-[10px] text-slate-500">{submitted ? "1 asset needs attention" : "All assets operational"}</p>
      </div>
      <div className="animate-float-slow absolute -right-36 bottom-24 hidden w-44 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur xl:block">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
          <Wrench className="size-3.5 text-primary-600" /> Health record
        </div>
        <p className="mt-1 text-[10px] leading-snug text-slate-500">24 checks · 3 repairs · every photo linked to FL-08</p>
      </div>
    </div>
  );
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

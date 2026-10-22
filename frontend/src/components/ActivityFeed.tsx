"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, CircleAlert, ClipboardCheck, QrCode, RefreshCw, Wrench } from "lucide-react";
import type { TimelineEvent } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { cn } from "./ui";

type Filter = "all" | "issues" | "checks" | "maintenance";

const FILTERS: { value: Filter; label: string; match: (e: TimelineEvent) => boolean }[] = [
  { value: "all", label: "All", match: () => true },
  { value: "issues", label: "Issues", match: (e) => e.kind === "issue" || e.level === "danger" || e.level === "warn" },
  { value: "checks", label: "Checks", match: (e) => e.kind === "inspection" },
  { value: "maintenance", label: "Maintenance", match: (e) => e.kind === "maintenance" },
];

const LEVEL = {
  ok: "bg-emerald-50 text-emerald-600 ring-emerald-600/15",
  warn: "bg-amber-50 text-amber-600 ring-amber-600/20",
  danger: "bg-red-50 text-red-600 ring-red-600/15",
  info: "bg-slate-50 text-slate-500 ring-slate-500/15",
};

const PAGE = 8;

function Icon({ e }: { e: TimelineEvent }) {
  const cls = "size-3.5";
  if (e.kind === "registered") return <QrCode className={cls} />;
  if (e.kind === "maintenance") return <Wrench className={cls} />;
  if (e.kind === "status") return <RefreshCw className={cls} />;
  if (e.level === "danger" || e.level === "warn") return <CircleAlert className={cls} />;
  return e.kind === "inspection" ? <ClipboardCheck className={cls} /> : <Check className={cls} />;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Compact, filterable activity list for the dashboard: one line per event, grouped by day. */
export function ActivityFeed({ events }: { events: TimelineEvent[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => events.filter(FILTERS.find((f) => f.value === filter)!.match), [events, filter]);
  const shown = filtered.slice(0, limit);
  const groups = useMemo(() => {
    const out: { day: string; items: TimelineEvent[] }[] = [];
    for (const e of shown) {
      const day = dayLabel(e.created_at);
      if (out.at(-1)?.day === day) out.at(-1)!.items.push(e);
      else out.push({ day, items: [e] });
    }
    return out;
  }, [shown]);

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-slate-900">Recent activity</h2>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        </div>
        <div className="flex gap-0.5 overflow-x-auto rounded-lg bg-slate-100 p-0.5">
          {FILTERS.map((f) => {
            const count = events.filter(f.match).length;
            return (
              <button
                key={f.value}
                onClick={() => {
                  setFilter(f.value);
                  setLimit(PAGE);
                }}
                className={cn(
                  "whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition",
                  filter === f.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
                )}
              >
                {f.label}
                {f.value !== "all" && count > 0 && <span className="ml-1 text-slate-400">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-slate-500">Nothing here yet.</p>
      ) : (
        <div className="max-h-[440px] overflow-y-auto overscroll-contain">
          {groups.map((g) => (
            <section key={g.day}>
              <h3 className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur sm:px-5">
                {g.day}
              </h3>
              <ul className="divide-y divide-slate-100">
                {g.items.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/assets/${e.asset_id}`}
                      title={e.detail || e.title}
                      className="group flex items-center gap-3 px-4 py-2.5 transition hover:bg-slate-50 sm:px-5"
                    >
                      <span className={cn("grid size-7 shrink-0 place-items-center rounded-full ring-1 ring-inset", LEVEL[e.level])}>
                        <Icon e={e} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-800">
                          <span className="mr-1.5 font-mono text-xs font-semibold text-primary-700">{e.asset_code}</span>
                          <span className="font-medium group-hover:text-slate-900">{e.title}</span>
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {[e.actor, e.detail.split("\n")[0]].filter(Boolean).join(" · ") || e.asset_name}
                        </p>
                      </div>
                      <time className="shrink-0 text-xs tabular-nums text-slate-400" dateTime={e.created_at} title={timeAgo(e.created_at)}>
                        {clock(e.created_at)}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 sm:px-5">
        <span>
          Showing {shown.length} of {filtered.length} · updates every 15 s
        </span>
        {filtered.length > shown.length && (
          <button onClick={() => setLimit((l) => l + 10)} className="font-medium text-primary-700 hover:underline">
            Show more
          </button>
        )}
      </div>
    </div>
  );
}

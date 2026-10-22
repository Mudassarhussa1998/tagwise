import Link from "next/link";
import { Check, CircleAlert, ClipboardCheck, QrCode, RefreshCw, Wrench } from "lucide-react";
import type { TimelineEvent } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { cn } from "./ui";

const LEVEL = {
  ok: "bg-emerald-100 text-emerald-700",
  warn: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-slate-100 text-slate-600",
};

function EventIcon({ event }: { event: TimelineEvent }) {
  const cls = "size-3.5";
  if (event.kind === "registered") return <QrCode className={cls} />;
  if (event.kind === "maintenance") return <Wrench className={cls} />;
  if (event.kind === "status") return <RefreshCw className={cls} />;
  if (event.level === "danger" || event.level === "warn") return <CircleAlert className={cls} />;
  return event.kind === "inspection" ? <ClipboardCheck className={cls} /> : <Check className={cls} />;
}

export function Timeline({ events, showAsset }: { events: TimelineEvent[]; showAsset?: boolean }) {
  return (
    <ol className="relative">
      {events.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < events.length - 1 && <span className="absolute left-[13px] top-7 bottom-0 w-px bg-slate-200" aria-hidden />}
          <span className={cn("relative z-10 grid size-7 shrink-0 place-items-center rounded-full", LEVEL[e.level])}>
            <EventIcon event={e} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-medium text-slate-900">
                {showAsset && e.asset_code && (
                  <Link href={`/assets/${e.asset_id}`} className="mr-1.5 font-mono text-xs font-semibold text-primary-700 hover:underline">
                    {e.asset_code}
                  </Link>
                )}
                {e.title}
              </p>
              <time className="text-xs text-slate-500 tabular-nums">{formatDateTime(e.created_at)}</time>
            </div>
            {e.detail && <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">{e.detail}</p>}
            {e.actor && <p className="mt-0.5 text-xs text-slate-500">by {e.actor}</p>}
            {e.photo_url && (
              <a href={e.photo_url} target="_blank" rel="noreferrer" className="mt-2 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.photo_url} alt="Evidence" className="h-20 w-28 rounded-md border border-slate-200 object-cover" />
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

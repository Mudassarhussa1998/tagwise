"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleCheck } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Card, cn, EmptyState, ErrorNote, SeverityBadge, Spinner } from "@/components/ui";
import { api, type IssueWithAsset } from "@/lib/api";
import { formatDateTime, timeAgo } from "@/lib/format";

export default function IssuesPage() {
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const [issues, setIssues] = useState<IssueWithAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<IssueWithAsset[]>(`/issues?status=${status}`).then(setIssues).catch((e) => setError(e.message));
  }, [status]);

  const switchTo = (s: typeof status) => {
    if (s === status) return;
    setIssues(null);
    setStatus(s);
  };

  return (
    <>
      <PageHeader title="Issues" subtitle="Failures reported from checks and QR scans. Resolve them by recording maintenance on the asset." />
      <div className="mb-4 inline-flex gap-1 rounded-lg bg-slate-200/60 p-1">
        {(["open", "resolved"] as const).map((s) => (
          <button
            key={s}
            onClick={() => switchTo(s)}
            className={cn("rounded-md px-3 py-1.5 text-xs font-medium capitalize", status === s ? "bg-white shadow-sm" : "text-slate-600")}
          >
            {s}
          </button>
        ))}
      </div>
      <ErrorNote message={error} />
      {!issues ? (
        <Spinner />
      ) : issues.length === 0 ? (
        <Card>
          <EmptyState icon={<CircleCheck className="size-6" />} title={status === "open" ? "No open issues" : "Nothing resolved yet"}>
            {status === "open" ? "Every reported failure has been handled." : "Resolved issues will appear here."}
          </EmptyState>
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {issues.map((i) => (
            <Link key={i.id} href={`/assets/${i.asset_id}`} className="flex gap-4 px-5 py-4 hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-primary-700">{i.asset_code}</span>
                  <SeverityBadge severity={i.severity} />
                  <span className="text-xs text-slate-500">{i.asset_name}</span>
                </div>
                <p className="mt-1 font-medium text-slate-900">{i.title}</p>
                {i.description && <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{i.description}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  Reported by {i.reported_by} · {formatDateTime(i.created_at)}
                  {i.resolved_at && ` · resolved ${timeAgo(i.resolved_at)}`}
                </p>
              </div>
              {i.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.photo_url} alt="Evidence" className="size-16 shrink-0 rounded-md border object-cover" />
              )}
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}

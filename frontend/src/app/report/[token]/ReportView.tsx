"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronDown, FileText, Printer, X } from "lucide-react";
import { PhotoGallery } from "@/components/PhotoGallery";
import { Timeline } from "@/components/Timeline";
import { Button, Card, cn, Logo, SeverityBadge, Spinner, StatusBadge } from "@/components/ui";
import { api, type AssetReport, type Inspection } from "@/lib/api";
import { formatDate, formatDateTime, timeAgo } from "@/lib/format";
import { PrintReport } from "./PrintReport";

export function ReportView() {
  const { token } = useParams<{ token: string }>();
  const [report, setReport] = useState<AssetReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<AssetReport>(`/public/report/${token}`).then(setReport).catch((e) => setError(e.message));
  }, [token]);

  if (error)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <FileText className="size-10 text-slate-300" />
        <h1 className="mt-3 text-lg font-semibold text-slate-900">Report not available</h1>
        <p className="mt-1 max-w-sm text-sm text-slate-500">{error}</p>
      </div>
    );
  if (!report) return <Spinner label="Loading report" />;

  const { stats } = report;
  const openIssues = report.issues.filter((i) => i.status === "open");

  return (
    <>
      <PrintReport report={report} token={token} />
      <div className="min-h-screen bg-slate-50 print:hidden">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
            <Logo />
            <Button variant="secondary" size="sm" onClick={() => window.print()} className="print:hidden">
              <Printer className="size-3.5" /> Print / PDF
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
          {/* Identity */}
          <Card className="p-5 sm:p-6">
            <div className={report.photos.length ? "grid gap-5 md:grid-cols-[minmax(0,20rem)_1fr] md:gap-6" : ""}>
              {report.photos.length > 0 && <PhotoGallery photos={report.photos.map((url) => ({ url }))} alt={`${report.code} ${report.name}`} />}
              <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{report.organization_name} · Asset report</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-slate-200 px-2 py-0.5 font-mono text-sm font-semibold text-slate-700">{report.code}</span>
                    <StatusBadge status={report.status} />
                  </div>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{report.name}</h1>
                </div>
                <p className="text-xs text-slate-500 sm:text-right">
                  Generated
                  <br className="hidden sm:block" /> {formatDateTime(report.generated_at)}
                </p>
              </div>
              <dl className={`mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 text-sm ${report.photos.length ? "sm:grid-cols-2" : "sm:grid-cols-4"}`}>
                {[
                  ["Category", report.category || "—"],
                  ["Location", report.location || "—"],
                  ["Responsible", report.owner_name || "—"],
                  ["Registered", formatDate(report.registered_at)],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-xs text-slate-500">{k}</dt>
                    <dd className="truncate font-medium text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>
              </div>
            </div>
          </Card>

          {/* Key numbers */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Checks", String(stats.total_checks), `${stats.failed_checks} failed`],
              ["Pass rate", stats.pass_rate === null ? "—" : `${Math.round(stats.pass_rate * 100)}%`, "all time"],
              ["Open issues", String(stats.open_issues), `${stats.resolved_issues} resolved`],
              ["Maintenance", String(stats.maintenance_count), "jobs recorded"],
              ["Last check", stats.last_check_at ? timeAgo(stats.last_check_at) : "Never", stats.last_check_at ? formatDate(stats.last_check_at) : ""],
              ["Last service", stats.last_maintenance_at ? timeAgo(stats.last_maintenance_at) : "Never", stats.last_maintenance_at ? formatDate(stats.last_maintenance_at) : ""],
            ].map(([label, value, sub]) => (
              <Card key={label} className="p-3.5">
                <p className="text-xs text-slate-500">{label}</p>
                <p className={cn("mt-1 text-xl font-semibold tabular-nums text-slate-900", label === "Open issues" && stats.open_issues > 0 && "text-red-600")}>{value}</p>
                {sub && <p className="mt-0.5 truncate text-[11px] text-slate-400">{sub}</p>}
              </Card>
            ))}
          </section>

          {openIssues.length > 0 && (
            <Section title={`Open issues (${openIssues.length})`} tone="danger">
              <ul className="divide-y divide-slate-100">
                {openIssues.map((i) => (
                  <li key={i.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={i.severity} />
                        <p className="text-sm font-medium text-slate-900">{i.title}</p>
                      </div>
                      {i.description && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{i.description}</p>}
                      <p className="mt-1 text-xs text-slate-500">
                        Reported by {i.reported_by} · {formatDateTime(i.created_at)}
                      </p>
                    </div>
                    {i.photo_url && <Photo src={i.photo_url} />}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="What gets checked">
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700 marker:text-slate-400">
                {report.checklist.map((c) => (
                  <li key={c.id}>{c.question}</li>
                ))}
              </ol>
            </Section>

            <Section title={`Maintenance (${report.maintenance.length})`}>
              {report.maintenance.length === 0 ? (
                <p className="text-sm text-slate-500">No maintenance recorded yet.</p>
              ) : (
                <ul className="space-y-3">
                  {report.maintenance.map((m) => (
                    <li key={m.id} className="text-sm">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium capitalize text-slate-900">{m.kind}</span>
                        <time className="shrink-0 text-xs text-slate-500">{formatDate(m.created_at)}</time>
                      </div>
                      <p className="whitespace-pre-line text-slate-600">{m.description}</p>
                      <p className="text-xs text-slate-500">by {m.performed_by}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <Section title={`Inspection history (${stats.total_checks})`}>
            {report.inspections.length === 0 ? (
              <p className="text-sm text-slate-500">No checks yet.</p>
            ) : (
              <ul className="-mx-1 divide-y divide-slate-100">
                {report.inspections.map((i) => (
                  <InspectionRow key={i.id} inspection={i} />
                ))}
              </ul>
            )}
            {stats.total_checks > report.inspections.length && (
              <p className="mt-3 text-xs text-slate-500">Showing the latest {report.inspections.length} checks.</p>
            )}
          </Section>

          <Section title="Full timeline">
            {report.events.length ? <Timeline events={report.events} /> : <p className="text-sm text-slate-500">No history yet.</p>}
          </Section>

          <p className="pb-4 text-center text-xs text-slate-400">
            {report.code} · {report.organization_name} · generated by Tagwise on {formatDateTime(report.generated_at)}
          </p>
        </main>
      </div>
    </>
  );
}

function Section({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "danger" }) {
  return (
    <Card className={cn("break-inside-avoid-page", tone === "danger" && "border-red-200")}>
      <h2 className={cn("border-b px-5 py-3 text-sm font-semibold", tone === "danger" ? "border-red-100 bg-red-50/60 text-red-800" : "border-slate-100 text-slate-900")}>{title}</h2>
      <div className="p-5">{children}</div>
    </Card>
  );
}

function Photo({ src }: { src: string }) {
  return (
    <a href={src} target="_blank" rel="noreferrer" className="shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Evidence" className="size-16 rounded-md border border-slate-200 object-cover" />
    </a>
  );
}

function InspectionRow({ inspection: i }: { inspection: Inspection }) {
  const [open, setOpen] = useState(false);
  const failed = i.answers.filter((a) => !a.ok);
  return (
    <li className="px-1 py-2.5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 text-left">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", i.passed ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
          {i.passed ? <Check className="size-4" /> : <X className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-900">
            {i.passed ? "Passed" : `Failed: ${failed.map((a) => a.question).join(", ")}`}
          </span>
          <span className="block text-xs text-slate-500">
            {i.inspector_name} · {formatDateTime(i.created_at)}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-slate-400 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-10 mt-2 space-y-1.5 text-sm">
          {i.answers.map((a, n) => (
            <p key={n} className="flex gap-2">
              {a.ok ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <X className="mt-0.5 size-4 shrink-0 text-red-600" />}
              <span className="text-slate-700">
                {a.question}
                {a.note && <span className="block text-xs text-slate-500">{a.note}</span>}
              </span>
            </p>
          ))}
          {i.notes && <p className="rounded-md bg-slate-50 p-2 text-slate-600">{i.notes}</p>}
          {i.photo_url && <Photo src={i.photo_url} />}
        </div>
      )}
    </li>
  );
}

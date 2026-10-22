"use client";

import { QRCodeSVG } from "qrcode.react";
import { LogoMark, statusLabel } from "@/components/ui";
import { reportUrl, type AssetReport, type AssetStatus } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";

/**
 * Print-only version of the asset report (shown via `hidden print:block`).
 * A document layout: compact tables, rows that never split across pages,
 * table headers that repeat on each page, and page numbers from globals.css.
 */

const STATUS_COLOR: Record<AssetStatus, string> = {
  operational: "#047857",
  attention: "#b45309",
  out_of_service: "#b91c1c",
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-[2mm] border-b-[0.4mm] border-primary-600 pb-[1mm] text-[8.5pt] font-bold uppercase tracking-[0.08em] text-primary-700">{children}</h2>;
}

function Table({ head, rows, widths }: { head: string[]; rows: React.ReactNode[][]; widths?: string[] }) {
  return (
    <table className="w-full table-fixed border-collapse text-[8.5pt] leading-snug">
      {widths && (
        <colgroup>
          {widths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
      )}
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} className="border-b-[0.3mm] border-slate-300 bg-slate-100 px-[2mm] py-[1.3mm] text-left text-[7.5pt] font-semibold uppercase tracking-wide text-slate-600">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="break-inside-avoid">
            {r.map((c, j) => (
              <td key={j} className="border-b-[0.2mm] border-slate-200 px-[2mm] py-[1.3mm] align-top text-slate-800">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PrintReport({ report, token }: { report: AssetReport; token: string }) {
  // Only rendered in the browser, after the report has loaded, so window is available.
  const liveUrl = reportUrl(token);
  const { stats } = report;
  const openIssues = report.issues.filter((i) => i.status === "open");

  return (
    <div className="hidden text-slate-900 print:block">
      {/* Header */}
      <header className="flex items-start justify-between gap-[6mm] border-b-[0.5mm] border-slate-900 pb-[3mm]">
        <div>
          <div className="flex items-center gap-[2mm] text-[9pt] font-semibold text-slate-600">
            <LogoMark className="size-[5mm]" /> Tagwise · {report.organization_name}
          </div>
          <h1 className="mt-[2mm] text-[20pt] font-bold leading-none tracking-tight">Asset Report</h1>
          <p className="mt-[1.5mm] text-[8.5pt] text-slate-500">Generated {formatDateTime(report.generated_at)}</p>
        </div>
        {liveUrl && (
          <div className="flex flex-col items-center">
            <QRCodeSVG value={liveUrl} size={76} level="M" marginSize={0} />
            <span className="mt-[1mm] text-[6.5pt] text-slate-500">Scan for live report</span>
          </div>
        )}
      </header>

      {/* Asset identity */}
      <section className="mt-[5mm] flex items-end justify-between gap-[4mm]">
        <div className="flex items-end gap-[4mm]">
          {report.photos[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={report.photos[0]} alt="" className="h-[26mm] w-[36mm] rounded-[1.5mm] border-[0.3mm] border-slate-300 object-cover" />
          )}
          <div>
            <p className="font-mono text-[16pt] font-bold leading-none">{report.code}</p>
            <p className="mt-[1mm] text-[12pt] font-semibold">{report.name}</p>
          </div>
        </div>
        <span
          className="rounded-full border-[0.4mm] px-[3mm] py-[0.8mm] text-[9pt] font-semibold"
          style={{ color: STATUS_COLOR[report.status], borderColor: STATUS_COLOR[report.status] }}
        >
          {statusLabel(report.status)}
        </span>
      </section>
      <table className="mt-[3mm] w-full border-collapse text-[8.5pt]">
        <tbody>
          {[
            ["Category", report.category || "—", "Location", report.location || "—"],
            ["Responsible", report.owner_name || "—", "Registered", formatDate(report.registered_at)],
          ].map((row, i) => (
            <tr key={i}>
              {row.map((c, j) => (
                <td key={j} className={`border-[0.2mm] border-slate-300 px-[2mm] py-[1.3mm] ${j % 2 === 0 ? "w-[18%] bg-slate-50 font-semibold text-slate-600" : "w-[32%]"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <section className="mt-[5mm] grid grid-cols-6 border-[0.3mm] border-slate-300">
        {[
          ["Checks", String(stats.total_checks), `${stats.failed_checks} failed`],
          ["Pass rate", stats.pass_rate === null ? "—" : `${Math.round(stats.pass_rate * 100)}%`, "all time"],
          ["Open issues", String(stats.open_issues), `${stats.resolved_issues} resolved`],
          ["Maintenance", String(stats.maintenance_count), "jobs"],
          ["Last check", stats.last_check_at ? formatDate(stats.last_check_at) : "Never", ""],
          ["Last service", stats.last_maintenance_at ? formatDate(stats.last_maintenance_at) : "Never", ""],
        ].map(([label, value, sub], i) => (
          <div key={label} className={`px-[2.5mm] py-[2mm] ${i > 0 ? "border-l-[0.3mm] border-slate-300" : ""}`}>
            <p className="text-[7pt] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-[0.5mm] text-[12pt] font-bold leading-tight ${label === "Open issues" && stats.open_issues > 0 ? "text-red-700" : ""}`}>{value}</p>
            {sub && <p className="text-[7pt] text-slate-500">{sub}</p>}
          </div>
        ))}
      </section>

      {openIssues.length > 0 && (
        <section className="mt-[6mm]">
          <H2>Open issues ({openIssues.length})</H2>
          <Table
            widths={["14%", "48%", "20%", "18%"]}
            head={["Severity", "Issue", "Reported by", "Date"]}
            rows={openIssues.map((i) => [
              <span key="s" className="font-semibold uppercase" style={{ color: i.severity === "high" ? "#b91c1c" : i.severity === "medium" ? "#b45309" : "#475569" }}>
                {i.severity}
              </span>,
              <span key="t">
                <span className="font-semibold">{i.title}</span>
                {i.description && <span className="block text-slate-600">{i.description}</span>}
              </span>,
              i.reported_by,
              formatDateTime(i.created_at),
            ])}
          />
        </section>
      )}

      <section className="mt-[6mm] grid grid-cols-[2fr_3fr] gap-[6mm]">
        <div className="break-inside-avoid">
          <H2>Checklist</H2>
          <ol className="list-decimal space-y-[0.8mm] pl-[4.5mm] text-[8.5pt] marker:text-slate-500">
            {report.checklist.map((c) => (
              <li key={c.id}>{c.question}</li>
            ))}
          </ol>
        </div>
        <div>
          <H2>Maintenance ({report.maintenance.length})</H2>
          {report.maintenance.length === 0 ? (
            <p className="text-[8.5pt] text-slate-500">No maintenance recorded.</p>
          ) : (
            <Table
              widths={["24%", "20%", "56%"]}
              head={["Date", "Type", "Work done"]}
              rows={report.maintenance.map((m) => [
                formatDate(m.created_at),
                <span key="k" className="capitalize">{m.kind}</span>,
                <span key="d">
                  {m.description}
                  <span className="block text-slate-500">by {m.performed_by}</span>
                </span>,
              ])}
            />
          )}
        </div>
      </section>

      <section className="mt-[6mm]">
        <H2>Inspection history ({stats.total_checks})</H2>
        {report.inspections.length === 0 ? (
          <p className="text-[8.5pt] text-slate-500">No checks recorded.</p>
        ) : (
          <Table
            widths={["20%", "20%", "12%", "48%"]}
            head={["Date", "Inspector", "Result", "Findings"]}
            rows={report.inspections.map((i) => {
              const failed = i.answers.filter((a) => !a.ok);
              return [
                formatDateTime(i.created_at),
                i.inspector_name,
                <span key="r" className="font-semibold" style={{ color: i.passed ? "#047857" : "#b91c1c" }}>
                  {i.passed ? "Pass" : "Fail"}
                </span>,
                <span key="f" className="text-slate-700">
                  {failed.length ? failed.map((a) => (a.note ? `${a.question} (${a.note})` : a.question)).join("; ") : "All items OK"}
                  {i.notes && <span className="block text-slate-500">Note: {i.notes}</span>}
                </span>,
              ];
            })}
          />
        )}
        {stats.total_checks > report.inspections.length && (
          <p className="mt-[1.5mm] text-[7.5pt] text-slate-500">Latest {report.inspections.length} of {stats.total_checks} checks shown.</p>
        )}
      </section>

      <section className="mt-[6mm]">
        <H2>Activity log</H2>
        <Table
          widths={["20%", "30%", "32%", "18%"]}
          head={["Date", "Event", "Details", "By"]}
          rows={report.events.map((e) => [formatDateTime(e.created_at), <span key="t" className="font-medium">{e.title}</span>, e.detail || "—", e.actor || "—"])}
        />
      </section>

      {/* Sign-off */}
      <section className="mt-[10mm] grid break-inside-avoid grid-cols-3 gap-[8mm] text-[8pt] text-slate-600">
        {["Reviewed by", "Signature", "Date"].map((l) => (
          <div key={l}>
            <div className="h-[10mm] border-b-[0.3mm] border-slate-400" />
            <p className="mt-[1mm]">{l}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

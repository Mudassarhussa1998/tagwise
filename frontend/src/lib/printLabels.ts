/**
 * Printable QR label sheet (A4), opened in a new window and sent to the printer.
 *
 * Labels are sized in millimetres so they come out the same on any printer:
 * 74 × 112 mm each, two fit side by side. A dashed line marks where to cut.
 */

export type LabelKind = "check" | "report";

export interface LabelAsset {
  code: string;
  name: string;
  location: string;
  organization: string;
}

const KIND = {
  check: {
    title: "SCAN TO CHECK",
    subtitle: "Run the checklist or report a failure",
    band: "background:#2563eb;color:#fff",
    icon: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  },
  report: {
    title: "SCAN FOR REPORT",
    subtitle: "Inspection & maintenance history",
    band: "background:#eff6ff;color:#1d4ed8;border-bottom:0.3mm solid #dbeafe",
    icon: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  },
} as const;

const LOGO = `<svg viewBox="0 0 32 32" width="100%" height="100%"><rect width="32" height="32" rx="8" fill="#2563eb"/><g fill="none" stroke="#fff" stroke-width="2"><rect x="7" y="7" width="7" height="7" rx="2"/><rect x="18" y="7" width="7" height="7" rx="2"/><rect x="7" y="18" width="7" height="7" rx="2"/></g><g fill="#fff"><rect x="9.5" y="9.5" width="2" height="2" rx=".5"/><rect x="20.5" y="9.5" width="2" height="2" rx=".5"/><rect x="9.5" y="20.5" width="2" height="2" rx=".5"/></g><path d="M18.5 21.8l2.4 2.4 4.6-5.2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function label(kind: LabelKind, qrSvg: string, a: LabelAsset): string {
  const k = KIND[kind];
  const qr = qrSvg.replace(/\swidth="\d+"/, ' width="100%"').replace(/\sheight="\d+"/, ' height="100%"');
  return `
  <div class="cut">
    <div class="label">
      <div class="band" style="${k.band}">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${k.icon}</svg>
        <div>
          <div class="title">${k.title}</div>
          <div class="subtitle">${k.subtitle}</div>
        </div>
      </div>
      <div class="qr">${qr}</div>
      <div class="code">${esc(a.code)}</div>
      <div class="name">${esc(a.name)}</div>
      ${a.location ? `<div class="loc">${esc(a.location)}</div>` : ""}
      <div class="foot">
        <span>Point your phone camera at the code · no app needed</span>
        <span class="brand"><span class="mark">${LOGO}</span>${esc(a.organization || "Tagwise")}</span>
      </div>
    </div>
  </div>`;
}

const STYLES = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #0f172a;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .toolbar { display: flex; justify-content: center; gap: 8px; padding: 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #475569; align-items: center; }
  .toolbar button { font: inherit; font-weight: 600; color: #fff; background: #2563eb; border: 0; border-radius: 8px; padding: 7px 14px; cursor: pointer; }
  .sheet { display: flex; flex-wrap: wrap; gap: 6mm; justify-content: center; padding: 8mm 0; }
  .cut { border: 0.3mm dashed #cbd5e1; border-radius: 6mm; padding: 2.5mm; break-inside: avoid; }
  .label { width: 74mm; height: 112mm; border: 0.35mm solid #cbd5e1; border-radius: 4mm; overflow: hidden;
           display: flex; flex-direction: column; align-items: center; background: #fff; }
  .band { width: 100%; display: flex; align-items: center; gap: 2.5mm; padding: 3mm 4mm; }
  .icon { width: 6.5mm; height: 6.5mm; flex: none; }
  .title { font-size: 4.2mm; font-weight: 800; letter-spacing: 0.35mm; line-height: 1.1; }
  .subtitle { font-size: 2.6mm; opacity: .85; margin-top: 0.5mm; }
  .qr { width: 54mm; height: 54mm; margin-top: 5mm; }
  .qr svg { display: block; }
  .code { font: 800 8.5mm/1 ui-monospace, "SF Mono", Menlo, Consolas, monospace; letter-spacing: 0.4mm; margin-top: 4mm; }
  .name { font-size: 3.6mm; font-weight: 600; margin-top: 1.8mm; text-align: center; padding: 0 4mm; }
  .loc { font-size: 3mm; color: #64748b; margin-top: 0.8mm; }
  .foot { margin-top: auto; width: 100%; border-top: 0.3mm solid #e2e8f0; padding: 2.2mm 4mm; display: flex; justify-content: space-between;
          align-items: center; gap: 2mm; font-size: 2.3mm; color: #64748b; }
  .brand { display: flex; align-items: center; gap: 1.2mm; font-weight: 600; color: #334155; white-space: nowrap; }
  .mark { width: 3.6mm; height: 3.6mm; display: inline-block; }
  @media print { .toolbar { display: none; } .sheet { padding: 0; } }
`;

export function labelSheetHtml(asset: LabelAsset, labels: { kind: LabelKind; svg: string }[], autoPrint = true): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(asset.code)} · QR label${labels.length > 1 ? "s" : ""}</title>
    <style>${STYLES}</style></head><body>
    <div class="toolbar">Labels print at actual size (74 × 112 mm). Cut along the dashed line. <button onclick="print()">Print</button></div>
    <div class="sheet">${labels.map((l) => label(l.kind, l.svg, asset)).join("")}</div>
    ${autoPrint ? "<script>window.onload = () => setTimeout(() => print(), 150);</script>" : ""}
    </body></html>`;
}

export function printLabels(asset: LabelAsset, labels: { kind: LabelKind; svg: string }[]) {
  const w = window.open("", "_blank", "width=820,height=760");
  if (!w) return;
  w.document.write(labelSheetHtml(asset, labels));
  w.document.close();
}

"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ClipboardCheck, Copy, Download, ExternalLink, FileText, Printer, RotateCcw } from "lucide-react";
import { reportUrl, scanUrl, type AssetSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { printLabels } from "@/lib/printLabels";
import { Button, cn } from "./ui";

const noopSubscribe = () => () => {};

type Kind = "check" | "report";

const KINDS: Record<Kind, { tab: string; icon: typeof FileText; heading: string; hint: string; file: string }> = {
  check: { tab: "Check", icon: ClipboardCheck, heading: "SCAN TO CHECK", hint: "Operators scan to run the checklist or report a failure.", file: "check" },
  report: { tab: "Report", icon: FileText, heading: "SCAN FOR REPORT", hint: "Anyone with this QR can view the asset's full history (read-only).", file: "report" },
};

export function QrCodes({ asset, onResetReport }: { asset: AssetSummary; onResetReport?: () => Promise<void> }) {
  const { user } = useAuth();
  const refs = { check: useRef<HTMLDivElement>(null), report: useRef<HTMLDivElement>(null) };
  // QR URLs depend on window.location, so they are empty during server rendering.
  const checkUrl = useSyncExternalStore(noopSubscribe, () => scanUrl(asset.qr_token), () => "");
  const fullReportUrl = useSyncExternalStore(noopSubscribe, () => reportUrl(asset.report_token), () => "");
  const urls: Record<Kind, string> = { check: checkUrl, report: fullReportUrl };

  const [kind, setKind] = useState<Kind>("check");
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);
  const meta = KINDS[kind];
  const url = urls[kind];

  const svgOf = (k: Kind) => refs[k].current?.querySelector("svg")?.outerHTML ?? "";

  const print = (kinds: Kind[]) =>
    printLabels(
      { code: asset.code, name: asset.name, location: asset.location, organization: user?.organization_name ?? "" },
      kinds.map((k) => ({ kind: k, svg: svgOf(k) })),
    );

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([svgOf(kind)], { type: "image/svg+xml" }));
    a.download = `tagwise-${asset.code}-${meta.file}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const reset = async () => {
    if (!onResetReport) return;
    if (!confirm("Reset the report link? Printed report QR codes and shared links will stop working.")) return;
    setResetting(true);
    await onResetReport().finally(() => setResetting(false));
  };

  const isLocal = /\/\/(localhost|127\.0\.0\.1)/.test(url);

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 grid w-full grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        {(Object.keys(KINDS) as Kind[]).map((k) => {
          const Icon = KINDS[k].icon;
          return (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition",
                kind === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
              )}
            >
              <Icon className="size-3.5" /> {KINDS[k].tab} QR
            </button>
          );
        })}
      </div>

      {/* Both QR codes stay mounted so "Print both" can read their SVGs. */}
      {(Object.keys(KINDS) as Kind[]).map((k) => (
        <div key={k} ref={refs[k]} className={cn("rounded-xl border border-slate-200 bg-white p-3", k !== kind && "hidden")}>
          {urls[k] ? <QRCodeSVG value={urls[k]} size={176} level="M" marginSize={1} /> : <div className="size-[176px]" />}
        </div>
      ))}
      <p className="mt-2 text-[11px] font-semibold tracking-[0.14em] text-primary-600">{meta.heading}</p>
      <p className="font-mono text-lg font-bold tracking-wide text-slate-900">{asset.code}</p>
      <p className="mt-1 max-w-[240px] text-center text-xs text-slate-500">{meta.hint}</p>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => print([kind])}>
          <Printer className="size-3.5" /> Print
        </Button>
        <Button variant="secondary" size="sm" onClick={download}>
          <Download className="size-3.5" /> SVG
        </Button>
        <Button variant="secondary" size="sm" onClick={copy}>
          <Copy className="size-3.5" /> {copied ? "Copied" : "Link"}
        </Button>
        <a href={url} target="_blank" rel="noreferrer">
          <Button variant="secondary" size="sm">
            <ExternalLink className="size-3.5" /> Open
          </Button>
        </a>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        <button onClick={() => print(["check", "report"])} className="text-xs font-medium text-primary-700 hover:underline">
          Print both labels
        </button>
        {kind === "report" && onResetReport && (
          <button onClick={reset} disabled={resetting} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 disabled:opacity-50">
            <RotateCcw className="size-3" /> Reset report link
          </button>
        )}
      </div>

      {isLocal && (
        <p className="mt-3 max-w-xs text-center text-xs text-amber-700">
          This QR points to localhost, which phones can&apos;t open. Set NEXT_PUBLIC_APP_URL to your computer&apos;s network address (see README).
        </p>
      )}
    </div>
  );
}

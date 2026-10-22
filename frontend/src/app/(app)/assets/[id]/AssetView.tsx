"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronDown, FileText, ListChecks, Pencil, Trash2, Wrench, X } from "lucide-react";
import { AssetForm, type AssetFormValues } from "@/components/AssetForm";
import { PhotoGallery } from "@/components/PhotoGallery";
import { QrCodes } from "@/components/QrLabel";
import { Timeline } from "@/components/Timeline";
import { Button, Card, cn, ErrorNote, Field, Modal, SeverityBadge, Spinner, StatusBadge } from "@/components/ui";
import { api, uploadAssetPhotos, type AssetDetail, type Inspection, type TimelineEvent } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime, timeAgo } from "@/lib/format";

type Tab = "history" | "inspections";

export function AssetView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [inspections, setInspections] = useState<Inspection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("history");
  const [modal, setModal] = useState<"edit" | "maintenance" | "checklist" | null>(null);

  useEffect(() => {
    Promise.all([api<AssetDetail>(`/assets/${id}`), api<TimelineEvent[]>(`/assets/${id}/timeline`)])
      .then(([a, ev]) => {
        setAsset(a);
        setEvents(ev);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (tab === "inspections" && inspections === null) {
      api<Inspection[]>(`/assets/${id}/inspections`).then(setInspections).catch((e) => setError(e.message));
    }
  }, [tab, inspections, id]);

  const afterSave = (a: AssetDetail) => {
    setModal(null);
    setAsset(a);
    api<TimelineEvent[]>(`/assets/${id}/timeline`).then(setEvents);
    setInspections(null);
  };

  const remove = async () => {
    if (!asset || !confirm(`Delete ${asset.code} and its entire history? This cannot be undone.`)) return;
    await api(`/assets/${asset.id}`, { method: "DELETE" });
    router.push("/assets");
  };

  if (error && !asset) return <ErrorNote message={error} />;
  if (!asset) return <Spinner />;
  const openIssues = asset.issues.filter((i) => i.status === "open");

  return (
    <>
      <Link href="/assets" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Assets
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-sm font-semibold text-slate-700">{asset.code}</span>
            <StatusBadge status={asset.status} />
          </div>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{asset.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {[asset.category, asset.location].filter(Boolean).join(" · ") || "No category or location"}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
          <Button variant="secondary" onClick={() => setModal("edit")}>
            <Pencil className="size-4" /> Edit
          </Button>
          <a href={`/report/${asset.report_token}`} target="_blank" rel="noreferrer" className="contents">
            <Button variant="secondary">
              <FileText className="size-4" /> Report
            </Button>
          </a>
          <Button onClick={() => setModal("maintenance")} className="col-span-2 sm:col-span-1">
            <Wrench className="size-4" /> Record maintenance
          </Button>
        </div>
      </div>
      <ErrorNote message={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Photos</h2>
              {asset.photos.length > 0 && <span className="text-xs text-slate-500">Shown on the QR check page and report</span>}
            </div>
            <PhotoGallery
              photos={asset.photos}
              alt={`${asset.code} ${asset.name}`}
              onAdd={async (files) => {
                try {
                  const updated = await uploadAssetPhotos(asset.id, files);
                  if (updated) setAsset(updated);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
              onRemove={async (photo) => {
                try {
                  setAsset(await api<AssetDetail>(`/assets/${asset.id}/photos/${photo.id}`, { method: "DELETE" }));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          </Card>

          {openIssues.length > 0 && (
            <Card className="border-red-200">
              <div className="flex items-center justify-between border-b border-red-100 bg-red-50/60 px-5 py-3">
                <h2 className="font-semibold text-red-800">
                  {openIssues.length} open issue{openIssues.length > 1 && "s"}
                </h2>
                <Button size="sm" variant="secondary" onClick={() => setModal("maintenance")}>
                  Resolve
                </Button>
              </div>
              <ul className="divide-y divide-slate-100">
                {openIssues.map((i) => (
                  <li key={i.id} className="flex gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={i.severity} />
                        <p className="truncate text-sm font-medium">{i.title}</p>
                      </div>
                      {i.description && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{i.description}</p>}
                      <p className="mt-1 text-xs text-slate-500">
                        {i.reported_by} · {timeAgo(i.created_at)}
                      </p>
                    </div>
                    {i.photo_url && (
                      <a href={i.photo_url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={i.photo_url} alt="Evidence" className="size-16 rounded-md border object-cover" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <div className="flex gap-1 border-b border-slate-100 px-3 pt-2">
              {(["history", "inspections"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2.5 text-sm font-medium capitalize",
                    tab === t ? "border-primary-600 text-primary-700" : "border-transparent text-slate-500 hover:text-slate-800",
                  )}
                >
                  {t === "history" ? "Health record" : `Checks (${asset.inspection_count})`}
                </button>
              ))}
            </div>
            <div className="p-4 sm:p-5">
              {tab === "history" ? (
                events.length ? <Timeline events={events} /> : <p className="text-sm text-slate-500">No history yet.</p>
              ) : inspections === null ? (
                <Spinner />
              ) : inspections.length === 0 ? (
                <p className="text-sm text-slate-500">No checks yet. Scan the QR code to complete the first one.</p>
              ) : (
                <ul className="space-y-2">
                  {inspections.map((i) => (
                    <InspectionRow key={i.id} inspection={i} />
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <QrCodes
              asset={asset}
              onResetReport={user?.role === "admin" ? async () => afterSave(await api<AssetDetail>(`/assets/${asset.id}/report-link/reset`, { method: "POST" })) : undefined}
            />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Details</h2>
            <dl className="space-y-2.5 text-sm">
              {[
                ["Responsible", asset.owner_name || "—"],
                ["Last check", asset.last_inspection_at ? formatDateTime(asset.last_inspection_at) : "Never"],
                ["Total checks", String(asset.inspection_count)],
                ["Registered", formatDate(asset.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right font-medium text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold">
                <ListChecks className="size-4 text-slate-500" /> Checklist
              </h2>
              <Button size="sm" variant="ghost" onClick={() => setModal("checklist")}>
                Edit
              </Button>
            </div>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700 marker:text-slate-400">
              {asset.checklist.map((c) => (
                <li key={c.id}>{c.question}</li>
              ))}
            </ol>
          </Card>

          {user?.role === "admin" && (
            <button onClick={remove} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-600">
              <Trash2 className="size-3.5" /> Delete asset
            </button>
          )}
        </div>
      </div>

      <Modal open={modal === "edit"} onClose={() => setModal(null)} title={`Edit ${asset.code}`}>
        <AssetForm
          initial={asset}
          submitLabel="Save changes"
          onSubmit={async (values: AssetFormValues) => afterSave(await api<AssetDetail>(`/assets/${asset.id}`, { method: "PATCH", body: values }))}
        />
      </Modal>
      <Modal open={modal === "maintenance"} onClose={() => setModal(null)} title="Record maintenance">
        <MaintenanceForm asset={asset} defaultName={user?.name ?? ""} onSaved={afterSave} />
      </Modal>
      <Modal open={modal === "checklist"} onClose={() => setModal(null)} title="Edit checklist">
        <ChecklistForm asset={asset} onSaved={afterSave} />
      </Modal>
    </>
  );
}

function InspectionRow({ inspection: i }: { inspection: Inspection }) {
  const [open, setOpen] = useState(false);
  const failed = i.answers.filter((a) => !a.ok).length;
  return (
    <li className="rounded-lg border border-slate-200">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className={cn("grid size-7 place-items-center rounded-full", i.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
          {i.passed ? <Check className="size-4" /> : <X className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{i.passed ? "Passed" : `Failed · ${failed} item${failed > 1 ? "s" : ""}`}</span>
          <span className="block text-xs text-slate-500">
            {i.inspector_name} · {formatDateTime(i.created_at)}
          </span>
        </span>
        <ChevronDown className={cn("size-4 text-slate-400 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          <ul className="space-y-1.5 text-sm">
            {i.answers.map((a, n) => (
              <li key={n} className="flex gap-2">
                {a.ok ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <X className="mt-0.5 size-4 shrink-0 text-red-600" />}
                <span>
                  {a.question}
                  {a.note && <span className="block text-xs text-slate-500">{a.note}</span>}
                </span>
              </li>
            ))}
          </ul>
          {i.notes && <p className="mt-3 rounded-md bg-slate-50 p-2 text-sm text-slate-600">{i.notes}</p>}
          {i.photo_url && (
            <a href={i.photo_url} target="_blank" rel="noreferrer" className="mt-3 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.photo_url} alt="Evidence" className="h-24 rounded-md border object-cover" />
            </a>
          )}
        </div>
      )}
    </li>
  );
}

function MaintenanceForm({ asset, defaultName, onSaved }: { asset: AssetDetail; defaultName: string; onSaved: (a: AssetDetail) => void }) {
  const openIssues = asset.issues.filter((i) => i.status === "open");
  const [kind, setKind] = useState<"corrective" | "preventive">(openIssues.length ? "corrective" : "preventive");
  const [description, setDescription] = useState("");
  const [performedBy, setPerformedBy] = useState(defaultName);
  const [resolve, setResolve] = useState<number[]>(openIssues.map((i) => i.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      onSaved(
        await api<AssetDetail>(`/assets/${asset.id}/maintenance`, {
          body: { kind, description, performed_by: performedBy, resolve_issue_ids: resolve },
        }),
      );
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(["corrective", "preventive"] as const).map((k) => (
          <button
            type="button"
            key={k}
            onClick={() => setKind(k)}
            className={cn("rounded-lg border px-3 py-2 text-sm font-medium capitalize", kind === k ? "border-primary-600 bg-primary-50 text-primary-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
          >
            {k}
          </button>
        ))}
      </div>
      <Field label="Work performed">
        <textarea className="input min-h-24" required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Replaced hydraulic hose, tested lift under load." />
      </Field>
      <Field label="Performed by">
        <input className="input" required value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} />
      </Field>
      {openIssues.length > 0 && (
        <fieldset>
          <legend className="label">Issues resolved by this work</legend>
          <div className="space-y-2">
            {openIssues.map((i) => (
              <label key={i.id} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2.5 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-emerald-600"
                  checked={resolve.includes(i.id)}
                  onChange={(e) => setResolve(e.target.checked ? [...resolve, i.id] : resolve.filter((x) => x !== i.id))}
                />
                <span>
                  {i.title} <SeverityBadge severity={i.severity} />
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">When no open issues remain, the asset goes back to Operational.</p>
        </fieldset>
      )}
      <ErrorNote message={error} />
      <div className="form-actions">
        <Button type="submit" loading={saving} className="w-full">
          Save maintenance
        </Button>
      </div>
    </form>
  );
}

function ChecklistForm({ asset, onSaved }: { asset: AssetDetail; onSaved: (a: AssetDetail) => void }) {
  const [text, setText] = useState(asset.checklist.map((c) => c.question).join("\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const items = text.split("\n").map((s) => s.trim()).filter(Boolean);
      onSaved(await api<AssetDetail>(`/assets/${asset.id}/checklist`, { method: "PUT", body: { items } }));
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Checks" hint="One per line. Past inspections keep the questions they were answered with.">
        <textarea className="input min-h-48" value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <ErrorNote message={error} />
      <div className="form-actions">
        <Button type="submit" loading={saving} className="w-full">
          Save checklist
        </Button>
      </div>
    </form>
  );
}

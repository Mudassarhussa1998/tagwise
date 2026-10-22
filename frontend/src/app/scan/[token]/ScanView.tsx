"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Camera, CircleAlert, CircleCheck, ClipboardCheck, MapPin, QrCode, TriangleAlert, X } from "lucide-react";
import { PhotoGallery } from "@/components/PhotoGallery";
import { Button, cn, ErrorNote, Spinner, StatusBadge } from "@/components/ui";
import { api, compressImage, type PublicAsset, type PublicResult, type Severity } from "@/lib/api";
import { timeAgo } from "@/lib/format";

type Mode = "home" | "check" | "report" | "done";
const NAME_KEY = "tagwise_operator_name";

function rememberedName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function ScanView() {
  const { token } = useParams<{ token: string }>();
  const [asset, setAsset] = useState<PublicAsset | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("home");
  const [result, setResult] = useState<PublicResult | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    api<PublicAsset>(`/public/${token}`)
      .then((a) => {
        setAsset(a);
        setName((n) => n || rememberedName());
      })
      .catch((e) => setLoadError(e.message));
  }, [token]);

  const finish = (r: PublicResult) => {
    try {
      localStorage.setItem(NAME_KEY, name.trim());
    } catch {}
    setResult(r);
    setAsset((a) => a && { ...a, status: r.asset_status });
    api<PublicAsset>(`/public/${token}`).then(setAsset).catch(() => {});
    setMode("done");
    window.scrollTo(0, 0);
  };

  if (loadError)
    return (
      <Shell>
        <div className="mt-16 text-center">
          <QrCode className="mx-auto size-10 text-slate-400" />
          <h1 className="mt-3 text-lg font-semibold">QR code not recognised</h1>
          <p className="mt-1 text-sm text-slate-500">{loadError}</p>
        </div>
      </Shell>
    );
  if (!asset) return <Spinner />;

  return (
    <Shell org={asset.organization_name}>
      {asset.photos.length > 0 && <PhotoGallery photos={asset.photos.map((url) => ({ url }))} alt={`${asset.code} ${asset.name}`} className="mb-3" />}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-primary-600">{asset.code}</p>
            <h1 className="mt-0.5 text-xl font-semibold leading-tight text-slate-900">{asset.name}</h1>
            {asset.location && (
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                <MapPin className="size-3.5" /> {asset.location}
              </p>
            )}
          </div>
          <StatusBadge status={asset.status} className="shrink-0" />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>Last check: {timeAgo(asset.last_inspection_at)}</span>
          {asset.open_issues > 0 && (
            <span className="font-medium text-amber-700">
              {asset.open_issues} open issue{asset.open_issues > 1 && "s"}
            </span>
          )}
        </div>
      </div>

      {mode === "home" && (
        <div className="mt-5 space-y-3">
          {asset.status === "out_of_service" && (
            <p className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              This asset is out of service. Do not operate it until maintenance clears it.
            </p>
          )}
          <button onClick={() => setMode("check")} className="flex w-full items-center gap-4 rounded-2xl border border-primary-500 bg-white p-5 text-left ring-1 ring-primary-500 transition hover:bg-primary-50/40 active:scale-[.99]">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-600 text-white">
              <ClipboardCheck className="size-6" />
            </span>
            <span>
              <span className="block text-lg font-semibold">Start check</span>
              <span className="block text-sm text-slate-500">{asset.checklist.length} items · about a minute</span>
            </span>
          </button>
          <button onClick={() => setMode("report")} className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:bg-slate-50 active:scale-[.99]">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
              <CircleAlert className="size-6" />
            </span>
            <span>
              <span className="block text-lg font-semibold">Report a failure</span>
              <span className="block text-sm text-slate-500">Something broken? Tell maintenance now.</span>
            </span>
          </button>
        </div>
      )}

      {mode === "check" && <CheckForm token={token} asset={asset} name={name} setName={setName} onCancel={() => setMode("home")} onDone={finish} />}
      {mode === "report" && <ReportForm token={token} name={name} setName={setName} onCancel={() => setMode("home")} onDone={finish} />}

      {mode === "done" && result && (
        <div className="mt-6 text-center">
          <span className={cn("mx-auto grid size-16 place-items-center rounded-full", result.ok ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600")}>
            {result.ok ? <CircleCheck className="size-9" /> : <CircleAlert className="size-9" />}
          </span>
          <h2 className="mt-4 text-xl font-semibold">{result.ok ? "Check complete" : "Thanks for reporting"}</h2>
          <p className="mt-1 text-slate-600">{result.message}</p>
          <Button variant="secondary" className="mt-6" onClick={() => setMode("home")}>
            Back to asset
          </Button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children, org }: { children: React.ReactNode; org?: string }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md px-4 pb-10 pt-5 sm:max-w-lg sm:pt-10">
        <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-slate-400">{org ?? "Tagwise"}</p>
        {children}
      </div>
    </div>
  );
}

function NameInput({ name, setName }: { name: string; setName: (s: string) => void }) {
  return (
    <label className="block">
      <span className="label">Your name</span>
      <input className="input py-3 text-base" required maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Who is doing this?" />
    </label>
  );
}

function PhotoInput({ photo, setPhoto, label }: { photo: File | null; setPhoto: (f: File | null) => void; label: string }) {
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  return preview ? (
    <div className="relative inline-block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview} alt="Selected evidence" className="h-28 rounded-xl border object-cover" />
      <button type="button" onClick={() => setPhoto(null)} className="absolute -right-2 -top-2 rounded-full border border-slate-200 bg-white p-1 text-slate-600 shadow-sm" aria-label="Remove photo">
        <X className="size-3.5" />
      </button>
    </div>
  ) : (
    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white py-4 hover:bg-slate-50 text-sm font-medium text-slate-600">
      <Camera className="size-5" /> {label}
      <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
    </label>
  );
}

type FormProps = { token: string; name: string; setName: (s: string) => void; onCancel: () => void; onDone: (r: PublicResult) => void };

function CheckForm({ token, asset, name, setName, onCancel, onDone }: FormProps & { asset: PublicAsset }) {
  const [answers, setAnswers] = useState<Record<number, { ok: boolean | null; note: string }>>(
    Object.fromEntries(asset.checklist.map((c) => [c.id, { ok: null, note: "" }])),
  );
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answered = Object.values(answers).filter((a) => a.ok !== null).length;
  const failed = Object.values(answers).some((a) => a.ok === false);
  const set = (id: number, patch: Partial<{ ok: boolean; note: string }>) =>
    setAnswers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (answered < asset.checklist.length) return setError("Answer every item before submitting.");
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append(
        "payload",
        JSON.stringify({
          inspector_name: name.trim(),
          notes,
          answers: asset.checklist.map((c) => ({ item_id: c.id, ok: answers[c.id].ok, note: answers[c.id].note })),
        }),
      );
      if (photo) form.append("photo", await compressImage(photo), "evidence.jpg");
      onDone(await api<PublicResult>(`/public/${token}/inspections`, { form }));
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Checklist</h2>
        <span className="text-sm tabular-nums text-slate-500">
          {answered}/{asset.checklist.length}
        </span>
      </div>
      <ol className="space-y-2.5">
        {asset.checklist.map((c, i) => {
          const a = answers[c.id];
          return (
            <li key={c.id} className={cn("rounded-xl border bg-white p-3.5", a.ok === false ? "border-red-300" : "border-slate-200")}>
              <p className="text-[15px] font-medium">
                <span className="mr-1.5 text-slate-400">{i + 1}.</span>
                {c.question}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => set(c.id, { ok: true })}
                  className={cn("rounded-lg border py-2.5 text-sm font-semibold", a.ok === true ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => set(c.id, { ok: false })}
                  className={cn("rounded-lg border py-2.5 text-sm font-semibold", a.ok === false ? "border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
                >
                  Not OK
                </button>
              </div>
              {a.ok === false && (
                <input className="input mt-2" placeholder="What's wrong?" maxLength={500} value={a.note} onChange={(e) => set(c.id, { note: e.target.value })} />
              )}
            </li>
          );
        })}
      </ol>
      <label className="block">
        <span className="label">Notes (optional)</span>
        <textarea className="input min-h-20 text-base" maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <PhotoInput photo={photo} setPhoto={setPhoto} label={failed ? "Add photo of the problem" : "Add photo (optional)"} />
      <NameInput name={name} setName={setName} />
      <ErrorNote message={error} />
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="secondary" size="lg" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="lg" loading={saving} className={cn("flex-1", failed && "bg-red-600 hover:bg-red-700")}>
          {failed ? "Submit and report issue" : "Submit check"}
        </Button>
      </div>
    </form>
  );
}

function ReportForm({ token, name, setName, onCancel, onDone }: FormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("reporter_name", name.trim());
      form.append("title", title.trim());
      form.append("description", description);
      form.append("severity", severity);
      if (photo) form.append("photo", await compressImage(photo), "evidence.jpg");
      onDone(await api<PublicResult>(`/public/${token}/issues`, { form }));
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  const levels: { value: Severity; label: string; hint: string; cls: string }[] = [
    { value: "low", label: "Minor", hint: "Can keep working", cls: "border-slate-500 bg-slate-50 text-slate-800 ring-1 ring-slate-500" },
    { value: "medium", label: "Needs repair", hint: "Fix soon", cls: "border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-500" },
    { value: "high", label: "Unsafe", hint: "Stop using it", cls: "border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500" },
  ];

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <h2 className="text-lg font-semibold">Report a failure</h2>
      <label className="block">
        <span className="label">What happened?</span>
        <input className="input py-3 text-base" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Brakes feel soft" />
      </label>
      <div>
        <span className="label">How serious is it?</span>
        <div className="grid grid-cols-3 gap-2">
          {levels.map((l) => (
            <button
              type="button"
              key={l.value}
              onClick={() => setSeverity(l.value)}
              className={cn("rounded-lg border p-2 text-center", severity === l.value ? l.cls : "border-slate-200 bg-white text-slate-600")}
            >
              <span className="block text-sm font-semibold">{l.label}</span>
              <span className={cn("block text-[11px]", "opacity-75")}>{l.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="label">Details (optional)</span>
        <textarea className="input min-h-20 text-base" maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <PhotoInput photo={photo} setPhoto={setPhoto} label="Take a photo" />
      <NameInput name={name} setName={setName} />
      <ErrorNote message={error} />
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="secondary" size="lg" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="lg" variant="danger" loading={saving} className="flex-1">
          Send report
        </Button>
      </div>
    </form>
  );
}

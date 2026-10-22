"use client";

import { useEffect, useMemo, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import type { AssetDetail, AssetStatus } from "@/lib/api";
import { Button, ErrorNote, Field } from "./ui";

export const DEFAULT_CHECKLIST = [
  "General visual condition is good",
  "No leaks (oil, fuel, hydraulic)",
  "Safety devices and alarms work",
  "Controls and brakes respond correctly",
];

export interface AssetFormValues {
  code: string;
  name: string;
  category: string;
  location: string;
  owner_name: string;
  status?: AssetStatus;
  status_reason?: string;
  checklist?: string[];
  /** Only when creating: pictures uploaded right after the asset is created. */
  photos?: File[];
}

export function AssetForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial?: AssetDetail;
  onSubmit: (values: AssetFormValues) => Promise<void>;
  submitLabel: string;
}) {
  const editing = !!initial;
  const [v, setV] = useState({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    category: initial?.category ?? "",
    location: initial?.location ?? "",
    owner_name: initial?.owner_name ?? "",
    status: initial?.status ?? ("operational" as AssetStatus),
    checklist: DEFAULT_CHECKLIST.join("\n"),
    status_reason: "",
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV({ ...v, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { checklist, status, status_reason, ...base } = v;
      await onSubmit(
        editing
          ? { ...base, status, status_reason }
          : { ...base, checklist: checklist.split("\n").map((s) => s.trim()).filter(Boolean), photos },
      );
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Code" hint="Printed on the QR label">
          <input className="input font-mono uppercase" required maxLength={40} placeholder="FL-08" value={v.code} onChange={set("code")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Name">
            <input className="input" required maxLength={160} placeholder="Toyota forklift" value={v.name} onChange={set("name")} />
          </Field>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">
          <input className="input" maxLength={80} placeholder="Forklift" value={v.category} onChange={set("category")} />
        </Field>
        <Field label="Location">
          <input className="input" maxLength={160} placeholder="Central warehouse" value={v.location} onChange={set("location")} />
        </Field>
      </div>
      <Field label="Responsible person">
        <input className="input" maxLength={120} placeholder="Who owns this asset?" value={v.owner_name} onChange={set("owner_name")} />
      </Field>
      {editing ? (
        <>
          <Field label="Status" hint="Status also updates automatically from checks and maintenance.">
            <select className="input" value={v.status} onChange={set("status")}>
              <option value="operational">Operational</option>
              <option value="attention">Needs attention</option>
              <option value="out_of_service">Out of service</option>
            </select>
          </Field>
          {v.status !== initial?.status && v.status !== "operational" && (
            <Field label="Reason" hint="An issue is opened with this reason so the asset shows up on the Issues list.">
              <textarea
                className="input min-h-20"
                maxLength={2000}
                placeholder={v.status === "out_of_service" ? "e.g. Hydraulic hose burst, waiting for parts" : "e.g. Unusual noise from gearbox"}
                value={v.status_reason}
                onChange={set("status_reason")}
              />
            </Field>
          )}
        </>
      ) : (
        <>
          <Field label="Checklist" hint="One check per line. Operators answer each one with OK / Not OK.">
            <textarea className="input min-h-32" value={v.checklist} onChange={set("checklist")} />
          </Field>
          <div>
            <span className="label">Photos (optional)</span>
            <div className="flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={src} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="size-16 rounded-lg border border-slate-200 object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos(photos.filter((_, n) => n !== i))}
                    className="absolute -right-1.5 -top-1.5 rounded-full border border-slate-200 bg-white p-0.5 text-slate-500 shadow-sm hover:text-red-600"
                    aria-label="Remove photo"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {photos.length < 8 && (
                <label className="grid size-16 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-slate-200 text-slate-400 transition hover:border-primary-300 hover:text-primary-600">
                  <ImagePlus className="size-5" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      setPhotos([...photos, ...Array.from(e.target.files ?? [])].slice(0, 8));
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            <span className="mt-1 block text-xs text-slate-500">Shown on the asset page, its QR check page and report. Up to 8.</span>
          </div>
        </>
      )}
      <ErrorNote message={error} />
      <Button type="submit" loading={saving} className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { cn, Modal } from "./ui";

export interface GalleryPhoto {
  id?: number;
  url: string;
}

/**
 * Cover image + thumbnail strip with a full-size viewer.
 * Pass `onAdd` / `onRemove` to make it editable (asset page); omit them for read-only (QR pages).
 */
export function PhotoGallery({
  photos,
  alt,
  onAdd,
  onRemove,
  max = 8,
  className,
}: {
  photos: GalleryPhoto[];
  alt: string;
  onAdd?: (files: File[]) => Promise<void>;
  onRemove?: (photo: GalleryPhoto) => Promise<void>;
  max?: number;
  className?: string;
}) {
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const editable = !!onAdd;
  const current = photos[Math.min(active, photos.length - 1)];

  const add = async (list: FileList | null) => {
    if (!list?.length || !onAdd) return;
    setBusy(true);
    try {
      await onAdd(Array.from(list).slice(0, max - photos.length));
      setActive(photos.length); // jump to the first new photo
    } finally {
      setBusy(false);
    }
  };

  const remove = async (photo: GalleryPhoto) => {
    if (!onRemove || !confirm("Remove this photo?")) return;
    setBusy(true);
    try {
      await onRemove(photo);
      setActive(0);
    } finally {
      setBusy(false);
    }
  };

  const picker = (label: React.ReactNode, cls: string) => (
    <label className={cn("cursor-pointer", busy && "pointer-events-none opacity-60", cls)}>
      {label}
      <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => add(e.target.files).finally(() => (e.target.value = ""))} />
    </label>
  );

  if (photos.length === 0) {
    if (!editable) return null;
    return picker(
      <span className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-primary-50 text-primary-600">
          {busy ? <LoaderCircle className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
        </span>
        <span className="text-sm font-medium text-slate-800">Add photos of this asset</span>
        <span className="max-w-xs text-xs text-slate-500">They help operators recognise it, and they appear on its QR check page and report.</span>
      </span>,
      cn("block rounded-xl border-2 border-dashed border-slate-200 transition hover:border-primary-300 hover:bg-primary-50/40", className),
    );
  }

  const go = (d: number) => setViewer((v) => (v === null ? v : (v + d + photos.length) % photos.length));

  return (
    <div className={className}>
      <button type="button" onClick={() => setViewer(photos.indexOf(current))} className="group relative block w-full overflow-hidden rounded-xl bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={alt} className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
        {photos.length > 1 && (
          <span className="absolute bottom-2 right-2 rounded-full bg-slate-900/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            {photos.indexOf(current) + 1} / {photos.length}
          </span>
        )}
      </button>

      {(photos.length > 1 || editable) && (
        <div className="mt-1.5 flex gap-2 overflow-x-auto p-1">
          {photos.map((p, i) => (
            <div key={p.id ?? p.url} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setActive(i)}
                className={cn("block size-14 overflow-hidden rounded-lg ring-2 transition", p === current ? "ring-primary-500" : "ring-transparent hover:ring-slate-300")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="size-full object-cover" />
              </button>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => remove(p)}
                  disabled={busy}
                  className="absolute -right-1.5 -top-1.5 rounded-full border border-slate-200 bg-white p-1 text-slate-500 shadow-sm hover:text-red-600"
                  aria-label="Remove photo"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          ))}
          {editable &&
            photos.length < max &&
            picker(
              <span className="grid size-14 place-items-center rounded-lg border-2 border-dashed border-slate-200 text-slate-400 transition hover:border-primary-300 hover:text-primary-600">
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              </span>,
              "shrink-0",
            )}
        </div>
      )}

      <Modal open={viewer !== null} onClose={() => setViewer(null)} title={`${alt}${photos.length > 1 && viewer !== null ? ` · ${viewer + 1} of ${photos.length}` : ""}`} wide>
        {viewer !== null && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[viewer].url} alt={alt} className="max-h-[70vh] w-full rounded-lg bg-slate-50 object-contain" />
            {photos.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-md hover:bg-white" aria-label="Previous photo">
                  <ChevronLeft className="size-5" />
                </button>
                <button type="button" onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-md hover:bg-white" aria-label="Next photo">
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

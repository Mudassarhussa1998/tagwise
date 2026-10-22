"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Boxes, ChevronRight, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { AssetForm, type AssetFormValues } from "@/components/AssetForm";
import { Button, Card, cn, EmptyState, ErrorNote, Modal, Spinner, StatusBadge } from "@/components/ui";
import { api, uploadAssetPhotos, type AssetDetail, type AssetStatus, type AssetSummary } from "@/lib/api";
import { timeAgo } from "@/lib/format";

const FILTERS: { value: AssetStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "operational", label: "Operational" },
  { value: "attention", label: "Needs attention" },
  { value: "out_of_service", label: "Out of service" },
];

export function AssetsView() {
  const router = useRouter();
  const params = useSearchParams();
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AssetStatus | "all">("all");
  const [creating, setCreating] = useState(params.get("new") === "1");

  useEffect(() => {
    api<AssetSummary[]>("/assets").then(setAssets).catch((e) => setError(e.message));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (assets ?? []).filter(
      (a) =>
        (filter === "all" || a.status === filter) &&
        (!q || [a.code, a.name, a.location, a.category, a.owner_name].some((f) => f.toLowerCase().includes(q))),
    );
  }, [assets, query, filter]);

  const create = async ({ photos, ...values }: AssetFormValues) => {
    const asset = await api<AssetDetail>("/assets", { body: values });
    if (photos?.length) await uploadAssetPhotos(asset.id, photos).catch(() => null); // the asset exists either way
    router.push(`/assets/${asset.id}`);
  };

  const closeModal = () => {
    setCreating(false);
    if (params.get("new")) router.replace("/assets");
  };

  return (
    <>
      <PageHeader
        title="Assets"
        subtitle={assets ? `${assets.length} registered` : undefined}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New asset
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search code, name, location…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 sm:flex">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition",
                filter === f.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ErrorNote message={error} />
      {!assets && !error ? (
        <Spinner />
      ) : (
        <Card className="overflow-hidden">
          {visible.length === 0 ? (
            <EmptyState icon={<Boxes className="size-6" />} title={assets?.length ? "No matching assets" : "No assets yet"}>
              {assets?.length ? "Try a different search or filter." : "Create your first asset to get its QR code."}
            </EmptyState>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="hidden border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 md:table-header-group">
                <tr>
                  <th className="px-5 py-3 font-medium">Asset</th>
                  <th className="px-5 py-3 font-medium">Location</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Last check</th>
                  <th className="px-5 py-3 font-medium text-right">Issues</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((a) => (
                  <tr key={a.id} className="group cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/assets/${a.id}`)}>
                    <td className="px-5 py-3">
                      <Link href={`/assets/${a.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        {a.cover_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.cover_url} alt="" className="size-10 shrink-0 rounded-lg border border-slate-200 object-cover" />
                        ) : (
                          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-100 font-mono text-[11px] font-bold text-slate-600">
                            {a.code.slice(0, 5)}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-900">{a.name}</span>
                          <span className="block truncate text-xs text-slate-500">
                            <span className="font-mono">{a.code}</span>
                            {a.category && ` · ${a.category}`}
                            <span className="md:hidden"> · {timeAgo(a.last_inspection_at)}</span>
                          </span>
                          <StatusBadge status={a.status} className="mt-1.5 md:hidden" />
                        </span>
                      </Link>
                    </td>
                    <td className="hidden px-5 py-3 text-slate-600 md:table-cell">{a.location || "—"}</td>
                    <td className="hidden px-5 py-3 md:table-cell">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="hidden px-5 py-3 md:table-cell">
                      <span className={cn(a.last_inspection_passed === false ? "text-red-600" : "text-slate-600")}>{timeAgo(a.last_inspection_at)}</span>
                    </td>
                    <td className="hidden px-5 py-3 text-right tabular-nums md:table-cell">
                      {a.open_issues > 0 ? <span className="font-semibold text-red-600">{a.open_issues}</span> : <span className="text-slate-400">0</span>}
                    </td>
                    <td className="pr-4 text-slate-300 group-hover:text-slate-500">
                      <ChevronRight className="size-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      <Modal open={creating} onClose={closeModal} title="New asset">
        <AssetForm onSubmit={create} submitLabel="Create asset and QR" />
      </Modal>
    </>
  );
}

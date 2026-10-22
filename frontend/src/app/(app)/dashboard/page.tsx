"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowRight, Boxes, CircleAlert, ClipboardCheck, PartyPopper, Plus } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Button, Card, EmptyState, ErrorNote, Spinner, StatusBadge } from "@/components/ui";
import { api, type Dashboard } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function Stat({ label, value, sub, icon, tone }: { label: string; value: number; sub?: string; icon: React.ReactNode; tone: string }) {
  return (
    <Card className="p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <span className={`rounded-lg p-1.5 ${tone}`}>{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      api<Dashboard>("/dashboard")
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 15000); // keep the control room view fresh
    return () => clearInterval(t);
  }, []);

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Spinner />;

  const { by_status: s, total_assets: total } = data;
  const pct = (n: number) => (total ? (n / total) * 100 : 0);

  return (
    <>
      <PageHeader
        title={`Hello, ${user?.name.split(" ")[0]}`}
        subtitle={`Here is what's happening across ${user?.organization_name} today.`}
        actions={
          <Link href="/assets?new=1">
            <Button>
              <Plus className="size-4" /> New asset
            </Button>
          </Link>
        }
      />

      {total === 0 ? (
        <Card>
          <EmptyState icon={<Boxes className="size-6" />} title="Register your first asset">
            Add a machine, print its QR code, and your team can start checks from their phones.
            <div className="mt-4">
              <Link href="/assets?new=1">
                <Button>
                  <Plus className="size-4" /> New asset
                </Button>
              </Link>
            </div>
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Assets" value={total} sub={`${s.operational} operational`} icon={<Boxes className="size-4" />} tone="bg-slate-100 text-slate-600" />
            <Stat label="Need attention" value={s.attention + s.out_of_service} sub={`${s.out_of_service} out of service`} icon={<CircleAlert className="size-4" />} tone="bg-slate-100 text-slate-600" />
            <Stat label="Open issues" value={data.open_issues} sub="Waiting for maintenance" icon={<Activity className="size-4" />} tone="bg-slate-100 text-slate-600" />
            <Stat label="Checks today" value={data.inspections_today} sub={`${data.inspections_7d} this week · ${data.failed_7d} failed`} icon={<ClipboardCheck className="size-4" />} tone="bg-slate-100 text-slate-600" />
          </div>

          <Card className="mt-3 p-4">
            <div className="mb-2 flex justify-between text-xs text-slate-500">
              <span>Fleet health</span>
              <span className="tabular-nums">{Math.round(pct(s.operational))}% operational</span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${pct(s.operational)}%` }} />
              <div className="bg-amber-400 transition-all duration-700" style={{ width: `${pct(s.attention)}%` }} />
              <div className="bg-red-500 transition-all duration-700" style={{ width: `${pct(s.out_of_service)}%` }} />
            </div>
          </Card>

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-5">
            <Card className="overflow-hidden lg:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="font-semibold">Needs attention</h2>
                <Link href="/issues" className="flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline">
                  All issues <ArrowRight className="size-3" />
                </Link>
              </div>
              {data.attention_assets.length === 0 ? (
                <EmptyState icon={<PartyPopper className="size-6" />} title="All clear">
                  Every asset is operational.
                </EmptyState>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.attention_assets.map((a) => (
                    <li key={a.id}>
                      <Link href={`/assets/${a.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50">
                        <span
                          className={`grid size-9 shrink-0 place-items-center rounded-lg font-mono text-[10px] font-bold ${a.status === "out_of_service" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}
                        >
                          {a.code.slice(0, 5)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{a.name}</p>
                          <p className="text-xs text-slate-500">
                            {a.open_issues} open issue{a.open_issues === 1 ? "" : "s"} · {a.location || "No location"}
                          </p>
                        </div>
                        <StatusBadge status={a.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="overflow-hidden lg:col-span-3">
              <ActivityFeed events={data.recent_events} />
            </Card>
          </div>
        </>
      )}
    </>
  );
}

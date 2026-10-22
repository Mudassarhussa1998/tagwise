"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, ClipboardCheck, Mail, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Card, cn, EmptyState, ErrorNote, Spinner } from "@/components/ui";
import { api, type PlatformCompany, type PlatformOverview, type PlatformSignups, type PlatformUser } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime, timeAgo } from "@/lib/format";

type Tab = "overview" | "companies" | "users" | "signups";

const TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "companies", label: "Companies" },
  { value: "users", label: "Users" },
  { value: "signups", label: "Sign-ups" },
];

/** Site-wide admin: every company, user and sign-up. Only for PLATFORM_ADMIN_EMAILS (enforced by the API). */
export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  if (user && !user.is_platform_admin) {
    return (
      <Card>
        <EmptyState icon={<ShieldCheck className="size-6" />} title="Platform admins only">
          This page shows every company on Tagwise. Ask the site owner to add your email to PLATFORM_ADMIN_EMAILS.
        </EmptyState>
      </Card>
    );
  }

  return (
    <>
      <PageHeader title="Platform admin" subtitle="Every company, user and sign-up on Tagwise." />
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 sm:inline-flex">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition sm:py-1.5",
              tab === t.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && <Overview onOpen={setTab} />}
      {tab === "companies" && <Companies />}
      {tab === "users" && <UsersList />}
      {tab === "signups" && <Signups />}
    </>
  );
}

function useLoad<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<T>(path).then(setData).catch((e) => setError(e.message));
  }, [path]);
  return { data, error };
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative mb-4">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input className="input pl-9" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

/* ------------------------------ Overview ------------------------------ */

function Overview({ onOpen }: { onOpen: (t: Tab) => void }) {
  const { data, error } = useLoad<PlatformOverview>("/platform/overview");
  if (error) return <ErrorNote message={error} />;
  if (!data) return <Spinner />;
  const t = data.totals;
  const stats = [
    { label: "Companies", value: t.companies, sub: `+${t.companies_7d} this week`, icon: Building2 },
    { label: "Users", value: t.users, sub: `+${t.users_7d} this week`, icon: Users },
    { label: "Assets", value: t.assets, sub: `${t.open_issues} open issues`, icon: ShieldCheck },
    { label: "Checks", value: t.inspections, sub: `${t.inspections_7d} this week`, icon: ClipboardCheck },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, sub, icon: Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{label}</p>
              <span className="rounded-lg bg-slate-100 p-1.5 text-slate-600">
                <Icon className="size-4" />
              </span>
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
          </Card>
        ))}
      </div>
      {t.pending_invites > 0 && (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Mail className="size-4 text-slate-400" /> {t.pending_invites} pending team invite{t.pending_invites > 1 && "s"} not yet accepted.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <SectionHeader title="Newest companies" onAll={() => onOpen("companies")} />
          <ul className="divide-y divide-slate-100">
            {data.recent_companies.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-600">
                  <Building2 className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{c.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {c.users} user{c.users !== 1 && "s"} · {c.assets} asset{c.assets !== 1 && "s"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(c.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="overflow-hidden">
          <SectionHeader title="Newest users" onAll={() => onOpen("users")} />
          <ul className="divide-y divide-slate-100">
            {data.recent_users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{initials(u.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{u.name}</p>
                  <p className="truncate text-xs text-slate-500">{u.company_name}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(u.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function SectionHeader({ title, onAll }: { title: string; onAll: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <button onClick={onAll} className="text-xs font-medium text-primary-700 hover:underline">
        View all
      </button>
    </div>
  );
}

/* ------------------------------ Companies ------------------------------ */

function Companies() {
  const { data, error } = useLoad<PlatformCompany[]>("/platform/companies");
  const [q, setQ] = useState("");
  const rows = useMemo(() => (data ?? []).filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())), [data, q]);
  if (error) return <ErrorNote message={error} />;
  if (!data) return <Spinner />;
  return (
    <>
      <SearchBox value={q} onChange={setQ} placeholder={`Search ${data.length} companies…`} />
      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={<Building2 className="size-6" />} title="No companies found" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="hidden border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 md:table-header-group">
              <tr>
                {["Company", "Users", "Assets", "Checks", "Open issues", "Last activity", "Created"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => (
                <tr key={c.id} className="block px-4 py-3 md:table-row md:p-0">
                  <td className="block md:table-cell md:px-4 md:py-3">
                    <p className="font-medium text-slate-900">{c.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500 md:hidden">
                      {c.users} users · {c.assets} assets · {c.inspections} checks
                      {c.open_issues > 0 && <span className="text-red-600"> · {c.open_issues} open issues</span>}
                    </p>
                    <p className="text-xs text-slate-400 md:hidden">
                      Created {formatDate(c.created_at)} · active {timeAgo(c.last_activity)}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 tabular-nums md:table-cell">
                    {c.users} <span className="text-xs text-slate-400">({c.admins} admin)</span>
                  </td>
                  <td className="hidden px-4 py-3 tabular-nums md:table-cell">{c.assets}</td>
                  <td className="hidden px-4 py-3 tabular-nums md:table-cell">{c.inspections}</td>
                  <td className={cn("hidden px-4 py-3 tabular-nums md:table-cell", c.open_issues > 0 && "font-semibold text-red-600")}>{c.open_issues}</td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{timeAgo(c.last_activity)}</td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

/* ------------------------------ Users ------------------------------ */

function UsersList() {
  const { data, error } = useLoad<PlatformUser[]>("/platform/users");
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((u) => [u.name, u.email, u.company_name].some((f) => f.toLowerCase().includes(s)));
  }, [data, q]);
  if (error) return <ErrorNote message={error} />;
  if (!data) return <Spinner />;
  return (
    <>
      <SearchBox value={q} onChange={setQ} placeholder={`Search ${data.length} users by name, email or company…`} />
      <Card className="divide-y divide-slate-100 overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={<Users className="size-6" />} title="No users found" />
        ) : (
          rows.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{initials(u.name)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{u.name}</p>
                <p className="truncate text-xs text-slate-500">{u.email}</p>
                <p className="truncate text-xs text-slate-400 sm:hidden">
                  {u.company_name} · joined {formatDate(u.created_at)}
                </p>
              </div>
              <div className="hidden min-w-0 text-right sm:block">
                <p className="truncate text-sm text-slate-700">{u.company_name}</p>
                <p className="text-xs text-slate-400">Joined {formatDate(u.created_at)}</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">{u.role}</span>
            </div>
          ))
        )}
      </Card>
    </>
  );
}

/* ------------------------------ Sign-ups ------------------------------ */

function Signups() {
  const { data, error } = useLoad<PlatformSignups>("/platform/signups");
  if (error) return <ErrorNote message={error} />;
  if (!data) return <Spinner label="Loading from Clerk" />;
  return (
    <>
      <p className="mb-4 text-sm text-slate-600">
        {data.clerk_total !== null && (
          <>
            <span className="font-semibold text-slate-900">{data.clerk_total}</span> accounts in Clerk in total.{" "}
          </>
        )}
        These signed up but haven&apos;t created or joined a company yet (from the newest 100 accounts).
      </p>
      <Card className="divide-y divide-slate-100 overflow-hidden">
        {data.without_company.length === 0 ? (
          <EmptyState icon={<UserPlus className="size-6" />} title="Everyone is set up">
            Every recent sign-up has created or joined a company.
          </EmptyState>
        ) : (
          data.without_company.map((s) => (
            <div key={s.clerk_id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700">
                <UserPlus className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{s.name}</p>
                <p className="truncate text-xs text-slate-500">{s.email}</p>
              </div>
              <div className="shrink-0 text-right text-xs text-slate-500">
                <p>Signed up {s.created_at ? timeAgo(s.created_at) : "—"}</p>
                <p className="text-slate-400">{s.last_sign_in_at ? `Last seen ${formatDateTime(s.last_sign_in_at)}` : "Never signed in"}</p>
              </div>
            </div>
          ))
        )}
      </Card>
    </>
  );
}

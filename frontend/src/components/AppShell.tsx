"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { Boxes, CircleAlert, LayoutDashboard, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn, Logo } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: Boxes },
  { href: "/issues", label: "Issues", icon: CircleAlert },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-3">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-primary-50 text-primary-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon className={cn("size-[18px]", active ? "text-primary-600" : "text-slate-400")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// usePathname() is request-time data on dynamic routes, so it streams in behind Suspense.
function CurrentNavLinks({ onNavigate }: { onNavigate: () => void }) {
  return <NavLinks pathname={usePathname()} onNavigate={onNavigate} />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const nav = (
    <Suspense fallback={<NavLinks pathname="" onNavigate={close} />}>
      <CurrentNavLinks onNavigate={close} />
    </Suspense>
  );

  const footer = (
    <div className="flex items-center gap-3 border-t border-slate-200 p-4">
      <UserButton appearance={{ elements: { avatarBox: "size-9" } }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
        <p className="truncate text-xs text-slate-500">
          {user?.organization_name}
          {user?.role === "admin" && " · Admin"}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center px-6">
          <Logo />
        </div>
        {nav}
        {footer}
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} className="-mr-1.5 rounded-md p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={close}>
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px]" />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex h-14 items-center justify-between px-6">
              <Logo />
              <button onClick={close} className="-mr-1.5 rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 pt-14 lg:pl-60 lg:pt-0">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

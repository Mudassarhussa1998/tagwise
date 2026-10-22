"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ErrorNote, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, signedIn, needsOnboarding, error } = useAuth();
  const router = useRouter();

  // proxy.ts already sends signed-out visitors to sign-in; this covers client-side sign-out.
  useEffect(() => {
    if (!ready) return;
    if (!signedIn) router.replace("/sign-in");
    else if (needsOnboarding) router.replace("/onboarding");
  }, [ready, signedIn, needsOnboarding, router]);

  // Always render the page segment (Next.js validates it during prerendering);
  // just keep it hidden until the session is confirmed.
  const allowed = ready && !!user;
  return (
    <AppShell>
      {ready && error && !user ? <ErrorNote message={error} /> : !allowed && <Spinner />}
      <div hidden={!allowed}>{children}</div>
    </AppShell>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SignOutButton } from "@clerk/nextjs";
import { AuthCard, AuthLayout } from "@/components/AuthCard";
import { Button, ErrorNote, Field, Spinner } from "@/components/ui";
import { api, type Me } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function OnboardingPage() {
  const { user, ready, email, setUser, error: sessionError } = useAuth();
  const router = useRouter();
  const [organization, setOrganization] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      setUser(await api<Me>("/auth/onboard", { body: { organization } }));
      router.push("/assets?new=1");
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <AuthLayout>
      {!ready || user ? (
        <Spinner />
      ) : (
        <AuthCard title="Set up your company" subtitle="You'll be the admin. You can invite your team afterwards.">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Company name">
              <input className="input" required minLength={2} maxLength={160} autoFocus autoComplete="organization" value={organization} onChange={(e) => setOrganization(e.target.value)} />
            </Field>
            <ErrorNote message={error ?? sessionError} />
            <Button type="submit" loading={saving} className="w-full">
              Continue
            </Button>
          </form>
          <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
            Joining an existing team? Ask your admin to invite <span className="font-medium text-slate-700">{email || "your email"}</span>, then reload this page.{" "}
            <SignOutButton>
              <button className="font-medium text-primary-700 hover:underline">Use another account</button>
            </SignOutButton>
          </p>
        </AuthCard>
      )}
    </AuthLayout>
  );
}

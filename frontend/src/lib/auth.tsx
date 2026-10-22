"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { api, setSessionReady, type Me, type Session } from "./api";

interface AuthState {
  /** The Tagwise user (organization + role) for the signed-in Clerk account. */
  user: Me | null;
  /** Clerk has loaded and, if signed in, the Tagwise session has been resolved. */
  ready: boolean;
  signedIn: boolean;
  /** Signed in with Clerk but not part of an organization yet. */
  needsOnboarding: boolean;
  email: string;
  error: string | null;
  setUser: (user: Me) => void;
}

const AuthContext = createContext<AuthState | null>(null);

type Loaded = Session & { clerkId: string };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useClerkAuth();
  const [session, setSession] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !userId) return;
    let cancelled = false;
    api<Session>("/auth/session")
      .then((s) => !cancelled && setSession({ ...s, clerkId: userId }))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userId]);

  // Ignore a session loaded for a previous Clerk account (sign-out, account switch).
  const current = isSignedIn && session?.clerkId === userId ? session : null;
  const setUser = useCallback((user: Me) => setSession({ user, email: user.email, clerkId: userId ?? "" }), [userId]);
  const hasUser = !!current?.user;

  useEffect(() => setSessionReady(hasUser), [hasUser]);

  const value: AuthState = {
    user: current?.user ?? null,
    ready: isLoaded && (!isSignedIn || !!current || !!error),
    signedIn: !!isSignedIn,
    needsOnboarding: !!current && !current.user,
    email: current?.email ?? "",
    error,
    setUser,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

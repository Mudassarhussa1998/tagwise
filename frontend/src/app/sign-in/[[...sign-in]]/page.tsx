import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import { AuthLayout } from "@/components/AuthCard";
import { Spinner } from "@/components/ui";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthLayout>
      {/* Clerk's form reads the URL (usePathname), so it streams in behind Suspense. */}
      <Suspense fallback={<Spinner />}>
        <SignIn />
      </Suspense>
    </AuthLayout>
  );
}

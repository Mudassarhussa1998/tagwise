import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Dashboard pages need a Clerk session. The landing page, sign-in/up and the
// public QR scan pages (/scan/...) stay open. API calls are proxied to FastAPI,
// which verifies the Clerk token itself.
const isProtected = createRouteMatcher(["/dashboard(.*)", "/assets(.*)", "/issues(.*)", "/team(.*)", "/onboarding(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals, static files and the /api proxy (photo uploads stream straight through).
    "/((?!_next|api/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};

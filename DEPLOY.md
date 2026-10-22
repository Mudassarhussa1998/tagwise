# Deploying Tagwise for free

| Part | Service | Notes |
| --- | --- | --- |
| Frontend (Next.js) | **Netlify** | Settings come from `netlify.toml` |
| Backend (FastAPI) | **Render** (free web service) | Settings come from `render.yaml`. Sleeps after ~15 min idle; the first request then takes ~30–60 s |
| Database | **Supabase** Postgres | Free plan |
| Photos | **Supabase Storage** | Free plan; the backend talks to it over its S3-compatible API |
| Sign-in | **Clerk** | Your existing keys work |

The code is already on GitHub (`Mudassarhussa1998/tagwise`). Sign in to each service with **Continue with GitHub**.

You'll copy values between dashboards; keep a text file open to collect them. Never commit them to git.

---

## 1. Supabase: database and photo storage (≈5 min)

1. [supabase.com](https://supabase.com) → **New project**. Name `tagwise`, pick a strong **database password** (save it), and a region near your users (e.g. *Mumbai* or *Singapore*).
2. **Database URL:** click **Connect** (top bar) → **Session pooler** → copy the URI. Replace `[YOUR-PASSWORD]` with your password. It looks like
   `postgresql://postgres.abcd1234:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`
   → this is **`DATABASE_URL`**. (Use the *pooler* one: Render can't reach the direct IPv6 address.)
3. **Photo bucket:** **Storage** → **New bucket** → name `photos`, turn on **Public bucket** → Create.
4. **S3 keys:** **Storage** → **Settings** (S3 Connection): turn on **Enable connection via S3 protocol** and copy:
   - **Endpoint** → `S3_ENDPOINT` (e.g. `https://abcd1234.supabase.co/storage/v1/s3`)
   - **Region** → `S3_REGION` (e.g. `ap-south-1`)
   - **New access key** → copy **Access key ID** → `S3_ACCESS_KEY_ID` and **Secret access key** → `S3_SECRET_ACCESS_KEY`
5. `S3_PUBLIC_URL` = `https://<project-ref>.supabase.co/storage/v1/object/public/photos`
   (the `<project-ref>` is the `abcd1234` part of your endpoint).

## 2. Render: the API (≈5 min)

1. [render.com](https://render.com) → **New** → **Blueprint** → connect GitHub → choose **tagwise**.
2. Render reads `render.yaml` and asks for the secret values. Fill in:

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | from Supabase step 2 |
   | `CLERK_PUBLISHABLE_KEY` | your `pk_test_...` key |
   | `CLERK_SECRET_KEY` | your `sk_test_...` key |
   | `CLERK_AUTHORIZED_PARTIES` | `https://tagwise.netlify.app` (your Netlify URL, see step 3; you can fix it later) |
   | `CORS_ORIGINS` | same as above |
   | `PLATFORM_ADMIN_EMAILS` | your email(s), comma-separated: these accounts get the **Admin** page with every company and user |
   | `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` | from Supabase steps 4–5 |

3. **Apply**. The first deploy installs packages, creates all tables (`alembic upgrade head`) and starts the API.
4. Copy the service URL, e.g. `https://tagwise-api.onrender.com`. Opening `https://tagwise-api.onrender.com/api/health` should show `{"ok":true}`.

## 3. Netlify: the website (≈5 min)

1. [netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project** → **GitHub** → **tagwise**.
2. Build settings are filled in from `netlify.toml` (base `frontend`). Leave them.
3. Under **Environment variables** → **Add variables**, add:

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | your `pk_test_...` key |
   | `CLERK_SECRET_KEY` | your `sk_test_...` key |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/dashboard` |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/onboarding` |
   | `API_URL` | your Render URL, e.g. `https://tagwise-api.onrender.com` |
   | `NEXT_PUBLIC_APP_URL` | your Netlify URL, e.g. `https://tagwise.netlify.app` |

4. **Deploy**. Afterwards, **Site configuration → Change site name** to `tagwise` (or any free name) so the URL is `https://tagwise.netlify.app`.
5. If the final URL differs from what you typed earlier, update `NEXT_PUBLIC_APP_URL` here (then **Deploys → Trigger deploy**) and `CLERK_AUTHORIZED_PARTIES` / `CORS_ORIGINS` on Render (it redeploys on save).

> `NEXT_PUBLIC_*` values and `API_URL` are baked in at build time, so **redeploy after changing them**.

## 4. Clerk (1 min)

Your current keys are a *development* instance: they work on the Netlify URL, and the sign-in box shows a small "Development mode" badge. In the Clerk dashboard, rename the application to **Tagwise** (Settings → Application name).

For a badge-free *production* instance, Clerk needs a domain you own (about $10/year). Add it in Netlify and Clerk, then swap in the `pk_live_` / `sk_live_` keys.

## 5. Try it

1. Open your Netlify URL → **Start free** → sign up → create your company. The live database starts empty.
   - Want the demo data? From your Mac: `cd backend && DATABASE_URL='<supabase url>' .venv/bin/python seed.py you@email.com`, then sign up with that email.
2. Create an asset, add a photo, open its QR code and **scan it with your phone**. It works on mobile data too, not just your Wi-Fi.
3. Reprint any QR labels made on `localhost` or your Wi-Fi address. New labels point to the Netlify URL.

## Updating

Push to `main`. Netlify and Render both redeploy automatically, and Render applies any new database migrations on start.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Site loads but data doesn't / "Can't reach the server" | `API_URL` on Netlify is wrong or Render is still waking up. Check `<render-url>/api/health`, then redeploy Netlify |
| "Invalid or expired session" after signing in | `CLERK_AUTHORIZED_PARTIES` on Render must exactly match the Netlify URL (`https://…`, no trailing slash) |
| Photo upload fails | Check the `S3_*` values; the `photos` bucket must be **public** |
| Render deploy fails at `alembic upgrade head` | `DATABASE_URL` is wrong. Use the Supabase *Session pooler* URI with your password filled in |
| QR codes point to the wrong site | Set `NEXT_PUBLIC_APP_URL` on Netlify and redeploy |

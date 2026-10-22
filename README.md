# Tagwise: QR asset inspections

Tag every asset with a QR code. Run checks, report failures and track maintenance from any phone.

- **Managers** sign in with Clerk, register assets, print QR labels, watch a live dashboard and record maintenance.
- **Operators** scan the QR with any phone camera (no app, no account), run the checklist, report failures and attach photos.
- Every inspection, failure, repair and status change lands on the asset's **health record**.

Each asset has **two QR codes**:

| QR | Opens | Who it's for |
| --- | --- | --- |
| **Check** (`/scan/<token>`) | Checklist + failure report form | Operators at the machine |
| **Report** (`/report/<token>`) | Read-only full report: status, key numbers, open issues, maintenance, every check and the full timeline; printable as PDF | Supervisors, auditors, clients, a technician on site |

The two use different tokens, so you can share the report without letting people submit checks. Admins can **reset the report link** from the asset page; old report QR codes then stop working, and check labels are unaffected.

| Part | Stack |
| --- | --- |
| `frontend/` | Next.js 16 (App Router, TypeScript, Tailwind CSS 4), Clerk (`@clerk/nextjs` 7), `qrcode.react`, `lucide-react` |
| `backend/` | FastAPI, SQLAlchemy 2, **PostgreSQL** (psycopg 3), Clerk session-token verification (PyJWT + JWKS) |

## How authentication works

1. Clerk handles sign-up, sign-in, passwords, social logins, MFA and the account menu.
2. The browser sends Clerk's short-lived session token to the API as `Authorization: Bearer <jwt>`.
3. FastAPI verifies it against your Clerk instance's public keys (RS256, issuer, expiry, `azp` origin), then maps the Clerk user to a Tagwise user, which holds the **organization** and **role** (admin or member).
4. A new account either **creates a company** on `/onboarding` (and becomes its admin) or **joins automatically** if an admin invited its verified email from the Team page.

QR scan pages (`/scan/...`) and their API (`/api/public/...`) stay public: the unguessable QR token is the key.

## Setup

You need Python 3.11+, Node 20+, PostgreSQL 14+ and a free [Clerk](https://clerk.com) account.

### 1. Clerk

Create an application at [dashboard.clerk.com](https://dashboard.clerk.com) and copy the **Publishable key** and **Secret key** from **API keys**.

### 2. Database

```bash
createdb tagwise
```

### 3. Backend (http://localhost:8000, API docs at `/docs`)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # then paste your Clerk keys into .env
uvicorn app.main:app --reload --port 8000
```

Create or update the tables (Alembic migrations in `backend/migrations/`):

```bash
alembic upgrade head
```

After changing a model, generate a migration with `alembic revision --autogenerate -m "what changed"` and review it before applying.

Optional demo data (4 assets with history), invited to your email as admin:

```bash
python seed.py you@company.com
```

Then sign up with that same email, and you'll land in "Demo Industries".

### 4. Frontend (http://localhost:3000)

```bash
cd frontend
npm install
cp .env.example .env.local   # then paste your Clerk keys into .env.local
npm run dev
```

The frontend proxies `/api/*` to the backend (see `next.config.ts`), so the browser only talks to port 3000.

## Environment variables

| File | Variable | Purpose |
| --- | --- | --- |
| `backend/.env` | `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Postgres connection (or one `DATABASE_URL`, which wins if set) |
| | `CLERK_PUBLISHABLE_KEY` | Used to find your Clerk instance (issuer + JWKS URL) |
| | `CLERK_SECRET_KEY` | Reads a user's name and verified email on first sign-in |
| | `CLERK_AUTHORIZED_PARTIES` | Origins allowed to mint tokens, e.g. `https://app.example.com` |
| | `CORS_ORIGINS` | Only needed if the browser calls the API directly |
| `frontend/.env.local` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk keys |
| | `API_URL` | Where the FastAPI server runs (default `http://127.0.0.1:8000`) |
| | `NEXT_PUBLIC_APP_URL` | Public URL encoded in QR codes |

## Tests

The backend tests run against a real Postgres database and sign their own tokens, so they don't need Clerk:

```bash
createdb tagwise_test
cd backend && pytest
```

## Scanning with a real phone

QR codes encode `<app url>/scan/<token>`. On `localhost`, a phone can't open that link. To test with a phone on the same Wi-Fi:

```bash
# in frontend/, with your computer's LAN IP (macOS: ipconfig getifaddr en0)
NEXT_PUBLIC_APP_URL=http://192.168.1.20:3000 ALLOWED_DEV_ORIGINS=192.168.1.20 npm run dev -- -H 0.0.0.0
```

## How status works

| Event | Result |
| --- | --- |
| Check with every item OK | Logged as passed |
| Check with an item "Not OK" | Medium-severity issue → **Needs attention** |
| Failure report marked *Unsafe* | High-severity issue → **Out of service** |
| Maintenance that resolves the last open issue | **Operational** again |

## API overview

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/auth/session` | Clerk token (no organization needed) |
| POST | `/api/auth/onboard` | Clerk token (no organization needed) |
| GET | `/api/dashboard`, `/api/users`, `/api/invites` | Member |
| POST/DELETE | `/api/invites`, `/api/invites/{id}` | Admin |
| GET/POST | `/api/assets` | Member |
| GET/PATCH/DELETE | `/api/assets/{id}` | Member (delete: admin) |
| PUT | `/api/assets/{id}/checklist` | Member |
| GET | `/api/assets/{id}/timeline`, `/api/assets/{id}/inspections` | Member |
| POST | `/api/assets/{id}/maintenance` | Member |
| GET | `/api/issues?status=open\|resolved` | Member |
| POST | `/api/assets/{id}/report-link/reset` | Admin |
| GET | `/api/public/report/{report_token}` | Report token |
| GET | `/api/public/{qr_token}` | QR token |
| POST | `/api/public/{qr_token}/inspections`, `/api/public/{qr_token}/issues` | QR token |

## Before deploying

- Use Clerk **production** keys and set `CLERK_AUTHORIZED_PARTIES` to your real domain.
- Store photos in S3 or similar instead of `backend/uploads/`.

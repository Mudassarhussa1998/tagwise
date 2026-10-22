import { getToken } from "@clerk/nextjs";

export type AssetStatus = "operational" | "attention" | "out_of_service";
export type Severity = "low" | "medium" | "high";

export interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "member";
  created_at: string;
}

export interface Me extends User {
  organization_name: string;
}

/** `user` is null when the Clerk account hasn't joined or created an organization yet. */
export interface Session {
  user: Me | null;
  email: string;
}

export interface Invite {
  id: number;
  email: string;
  role: "admin" | "member";
  invited_by: string;
  created_at: string;
}

export interface AssetSummary {
  id: number;
  code: string;
  name: string;
  category: string;
  location: string;
  owner_name: string;
  status: AssetStatus;
  qr_token: string;
  report_token: string;
  created_at: string;
  open_issues: number;
  last_inspection_at: string | null;
  last_inspection_passed: boolean | null;
  cover_url: string | null;
}

export interface ChecklistItem {
  id: number;
  question: string;
  position: number;
}

export interface Issue {
  id: number;
  asset_id: number;
  title: string;
  description: string;
  severity: Severity;
  status: "open" | "resolved";
  reported_by: string;
  photo_url: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface IssueWithAsset extends Issue {
  asset_code: string;
  asset_name: string;
}

export interface AssetPhoto {
  id: number;
  url: string;
  created_at: string;
}

export interface AssetDetail extends AssetSummary {
  photos: AssetPhoto[];
  checklist: ChecklistItem[];
  issues: Issue[];
  inspection_count: number;
}

export interface Inspection {
  id: number;
  inspector_name: string;
  passed: boolean;
  notes: string;
  photo_url: string | null;
  created_at: string;
  answers: { question: string; ok: boolean; note: string }[];
}

export interface TimelineEvent {
  id: number;
  asset_id: number;
  kind: "registered" | "inspection" | "issue" | "maintenance" | "status";
  level: "ok" | "warn" | "danger" | "info";
  title: string;
  detail: string;
  actor: string;
  photo_url: string | null;
  created_at: string;
  asset_code?: string;
  asset_name?: string;
}

export interface Dashboard {
  total_assets: number;
  by_status: Record<AssetStatus, number>;
  open_issues: number;
  inspections_today: number;
  inspections_7d: number;
  failed_7d: number;
  attention_assets: AssetSummary[];
  recent_events: TimelineEvent[];
}

export interface PublicAsset {
  code: string;
  name: string;
  category: string;
  location: string;
  status: AssetStatus;
  organization_name: string;
  photos: string[];
  checklist: ChecklistItem[];
  open_issues: number;
  last_inspection_at: string | null;
}

export interface Maintenance {
  id: number;
  kind: "preventive" | "corrective";
  description: string;
  performed_by: string;
  created_at: string;
}

export interface AssetReport {
  organization_name: string;
  code: string;
  name: string;
  category: string;
  location: string;
  owner_name: string;
  status: AssetStatus;
  registered_at: string;
  generated_at: string;
  photos: string[];
  stats: {
    total_checks: number;
    failed_checks: number;
    pass_rate: number | null;
    open_issues: number;
    resolved_issues: number;
    maintenance_count: number;
    last_check_at: string | null;
    last_maintenance_at: string | null;
  };
  checklist: ChecklistItem[];
  issues: Issue[];
  maintenance: Maintenance[];
  inspections: Inspection[];
  events: TimelineEvent[];
}

export interface PublicResult {
  ok: boolean;
  message: string;
  asset_status: AssetStatus;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function errorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) {
    const first = detail[0];
    const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : "";
    return field && field !== "body" ? `${field}: ${first.msg}` : first.msg;
  }
  return fallback;
}

// Organization-scoped calls wait until /auth/session has confirmed (or just created, via an
// invite) the user's membership. Without this, a page that mounts during that first request
// races it and gets a 403 "onboarding_required".
let sessionOpen = false;
let openSession: () => void = () => {};
let sessionGate = new Promise<void>((resolve) => (openSession = resolve));

export function setSessionReady(ready: boolean) {
  if (ready && !sessionOpen) {
    sessionOpen = true;
    openSession();
  } else if (!ready && sessionOpen) {
    sessionOpen = false;
    sessionGate = new Promise<void>((resolve) => (openSession = resolve));
  }
}

type Options = { method?: string; body?: unknown; form?: FormData };

export async function api<T>(path: string, { method, body, form }: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (!path.startsWith("/public/") && !path.startsWith("/auth/")) await sessionGate;
  // QR scan endpoints are public; everything else carries the Clerk session token.
  if (!path.startsWith("/public/")) {
    const token = await getToken().catch(() => null);
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: method ?? (body !== undefined || form ? "POST" : "GET"),
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, errorMessage(data?.detail, `Request failed (${res.status})`));
  return data as T;
}

/** Downscale phone photos before upload so they stay well under the 8 MB limit. */
export async function compressImage(file: File, maxSide = 1600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.82));
  } catch {
    return file; // format the browser can't decode (e.g. HEIC on desktop); let the server validate it
  }
}

/** Absolute URL for a QR code. Uses NEXT_PUBLIC_APP_URL so phones get a reachable address. */
function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  return `${base.replace(/\/$/, "")}${path}`;
}

/** QR that opens the operator check / failure report form. */
export const scanUrl = (token: string) => appUrl(`/scan/${token}`);

/** QR that opens the read-only full asset report. */
export const reportUrl = (token: string) => appUrl(`/report/${token}`);

/** Upload pictures of an asset one by one (downscaled first). Returns the updated asset. */
export async function uploadAssetPhotos(assetId: number, files: File[]): Promise<AssetDetail | null> {
  let latest: AssetDetail | null = null;
  for (const file of files) {
    const form = new FormData();
    form.append("photo", await compressImage(file), file.name.replace(/\.\w+$/, "") + ".jpg");
    latest = await api<AssetDetail>(`/assets/${assetId}/photos`, { form });
  }
  return latest;
}

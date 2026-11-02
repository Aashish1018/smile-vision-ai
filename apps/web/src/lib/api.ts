/**
 * Typed client for the SmileOS API. Types are generated from the FastAPI OpenAPI spec
 * (`pnpm gen:api`), so a backend contract change surfaces as a compile error here.
 */
import type { components } from "./api-types";
import { parseSSE } from "./sse";

type Schemas = components["schemas"];
export type Scan = Schemas["ScanOut"];
export type Plan = Schemas["PlanOut"];
export type PlanDraft = Schemas["PlanDraft"];
export type PlanStep = Schemas["PlanStep"];
export type Observation = Schemas["Observation"];
export type Scores = Schemas["Scores"];
export type Clinic = Schemas["ClinicOut"];
export type Me = Schemas["MeOut"];
export type Metrics = Schemas["MetricsOut"];
export type SharedScan = Schemas["SharedScanOut"];
export type ChatTurn = Schemas["ChatTurn"];
export type Evidence = Schemas["Evidence"];
export type Treatment = Schemas["TreatmentOut"];

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

type TokenProvider = () => Promise<string | null>;
let getToken: TokenProvider = async () => null;
export const setTokenProvider = (fn: TokenProvider) => {
  getToken = fn;
};

async function headers(extra?: HeadersInit): Promise<Headers> {
  const h = new Headers(extra);
  const token = await getToken();
  if (token) h.set("Authorization", `Bearer ${token}`);
  return h;
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    if (body?.error) return new ApiError(res.status, body.error.code, body.error.message);
    if (body?.detail) return new ApiError(res.status, "validation_error", "Some fields are invalid.");
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(res.status, "http_error", `Request failed (${res.status}).`);
}

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const h = await headers(rest.headers);
  if (json !== undefined) h.set("Content-Type", "application/json");
  const res = await fetch(`${API_URL}${path}`, { ...rest, headers: h, body: json !== undefined ? JSON.stringify(json) : rest.body });
  if (!res.ok) throw await toError(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  devLogin: (email: string, role: Me["role"], clinic: string | null) =>
    request<Schemas["TokenOut"]>("/api/auth/dev-login", { method: "POST", json: { email, role, clinic } }),
  me: () => request<Me>("/api/me"),
  clinics: () => request<Clinic[]>("/api/clinics"),
  treatments: () => request<Treatment[]>("/api/treatments"),
  scans: () => request<Scan[]>("/api/scans"),
  scan: (id: string) => request<Scan>(`/api/scans/${id}`),
  deleteScan: (id: string) => request<void>(`/api/scans/${id}`, { method: "DELETE" }),
  share: (id: string, enabled: boolean, consent: boolean) =>
    request<Scan>(`/api/scans/${id}/share`, { method: "PUT", json: { enabled, consent } }),
  createPlan: (id: string) => request<Plan>(`/api/scans/${id}/plan`, { method: "POST" }),
  reviewQueue: () => request<Scan[]>("/api/clinic/reviews"),
  review: (planId: string, action: "approve" | "reject", notes: string | null) =>
    request<Plan>(`/api/clinic/plans/${planId}/review`, { method: "POST", json: { action, notes } }),
  metrics: () => request<Metrics>("/api/clinic/metrics"),
  shared: (token: string) => request<SharedScan>(`/api/public/share/${token}`),
};

/** Fetch an image that needs auth and return an object URL (an <img> tag can't send headers). */
export async function fetchImage(path: string, { auth = true } = {}): Promise<string> {
  const res = await fetch(`${API_URL}${path}`, { headers: auth ? await headers() : undefined });
  if (!res.ok) throw await toError(res);
  return URL.createObjectURL(await res.blob());
}

/** POST and consume a server-sent event stream; `onEvent` receives parsed JSON payloads. */
export async function streamPost(
  path: string,
  body: FormData | object,
  onEvent: (event: string, data: unknown) => void,
  signal?: AbortSignal,
): Promise<void> {
  const isForm = body instanceof FormData;
  const h = await headers(isForm ? undefined : { "Content-Type": "application/json" });
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: h,
    body: isForm ? body : JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw await toError(res);
  for await (const msg of parseSSE(res.body)) {
    const data = msg.data ? JSON.parse(msg.data) : null;
    if (msg.event === "error") {
      const err = data as { code: string; message: string };
      throw new ApiError(res.status, err.code, err.message);
    }
    onEvent(msg.event, data);
  }
}

import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

// ---------------------------------------------------------------------------
// Cliente HTTP da API do backend (FastAPI). Base vem do .env do Expo.
// ---------------------------------------------------------------------------
const RAW = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";
export const API_BASE = RAW.replace(/\/+$/, "") + "/api";

export const ADMIN_TOKEN_KEY = "admin_token";

export async function getAdminToken(): Promise<string | null> {
  return storage.secureGet(ADMIN_TOKEN_KEY, null);
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
}

async function readErrorDetail(res: Response): Promise<string> {
  let detail = `Erro ${res.status}`;
  try {
    const json = await res.json();
    if (typeof json?.detail === "string") detail = json.detail;
    else if (Array.isArray(json?.detail) && json.detail[0]?.msg) detail = String(json.detail[0].msg);
  } catch {
    // corpo não-JSON
  }
  return detail;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers["Authorization"] = `Bearer ${options.token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    throw new Error(await readErrorDetail(res));
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Upload multipart — funciona em web (blob) e nativo (FormData com uri).
// ---------------------------------------------------------------------------
export async function uploadFile<T>(
  path: string,
  uri: string,
  name: string,
  mime: string,
  token?: string | null,
): Promise<T> {
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri, name, type: mime } as unknown as Blob);  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) {
    throw new Error(await readErrorDetail(res));
  }
  return (await res.json()) as T;
}

// image_url pode ser absoluta (demonstração) ou relativa (/api/files/...).
export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url.startsWith("/") ? url : `/${url}`}`;
}

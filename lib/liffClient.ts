"use client";
import liff from "@line/liff";
import { DEMO, demoResponse } from "@/lib/demo";

let initialized = false;

export async function initLiff(): Promise<void> {
  if (DEMO) return; // デモは LINE ログイン不要
  if (initialized) return;
  await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
  if (!liff.isLoggedIn()) {
    liff.login();
    return;
  }
  initialized = true;
}

export function getIdToken(): string | null {
  try {
    return liff.getIDToken();
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; data?: T; error?: string }> {
  if (DEMO) return demoResponse<T>(path, init);
  const token = getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...init, headers });
  return (await res.json()) as { ok: boolean; data?: T; error?: string };
}

"use client";
import { useEffect, useState } from "react";
import { initLiff } from "@/lib/liffClient";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    initLiff()
      .then(() => setState("ready"))
      .catch(() => setState("error"));
  }, []);
  if (state === "loading") return <main className="p-6">読み込み中...</main>;
  if (state === "error")
    return <main className="p-6">LINEログインに失敗しました。アプリを開き直してください。</main>;
  return <>{children}</>;
}

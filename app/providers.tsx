"use client";
import { useEffect, useState } from "react";
import { initLiff, apiFetch } from "@/lib/liffClient";
import { NotRegistered } from "@/components/not-registered";
import { DEMO } from "@/lib/demo";

// LIFFログイン → スタッフ登録の確認、の2段で入口を固める。
// 未登録/承認待ち(401)は専用画面へ。それ以外の失敗はエラー表示（障害と未登録を混同しない）。
export default function Providers({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "ready" | "unregistered" | "error">(
    "loading"
  );
  const [msg, setMsg] = useState<string>();

  useEffect(() => {
    initLiff()
      .then(async () => {
        if (DEMO) {
          setState("ready");
          return;
        }
        const r = await apiFetch("/api/me");
        if (r.ok) setState("ready");
        else if (r.status === 401) setState("unregistered");
        else {
          setMsg(r.error);
          setState("error");
        }
      })
      .catch(() => setState("error"));
  }, []);

  if (state === "loading") return <main className="p-6">読み込み中...</main>;
  if (state === "unregistered") return <NotRegistered />;
  if (state === "error")
    return (
      <main className="p-6">
        <p>接続に失敗しました。アプリを開き直してください。</p>
        {msg && <p className="text-sm text-muted mt-2">{msg}</p>}
      </main>
    );
  return <>{children}</>;
}

"use client";
import { useEffect, useState } from "react";
import liff from "@line/liff";
import { Check, Copy, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// スタッフ登録がまだ／承認待ちの人に出す画面。
// 従来はLINEのuserIdを本人が取る手段が無く、管理者がSQLで手打ちするしかなかった。
// ここで本人が申請し、既存スタッフが設定画面から承認する流れにする。
export function NotRegistered() {
  const [profile, setProfile] = useState<{ userId: string; displayName: string }>();
  const [state, setState] = useState<"idle" | "sending" | "pending" | "error">("idle");
  const [msg, setMsg] = useState<string>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    liff
      .getProfile()
      .then((p) => setProfile({ userId: p.userId, displayName: p.displayName ?? "" }))
      .catch(() => {});
  }, []);

  async function apply() {
    setState("sending");
    setMsg(undefined);
    const r = await apiFetch<{ status: string }>("/api/staff/register", {
      method: "POST",
      body: JSON.stringify({ name: profile?.displayName ?? "" }),
    });
    if (r.ok) {
      setState("pending");
    } else {
      setState("error");
      setMsg(r.error);
    }
  }

  function copyId() {
    if (!profile) return;
    navigator.clipboard?.writeText(profile.userId).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {}
    );
  }

  return (
    <main className="px-5 py-10 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-2">はじめての利用登録</h1>
      <p className="text-sm text-muted mb-6">
        このアプリを使うには管理者の承認が必要です。下のボタンで申請してください。
      </p>

      <Card className="mb-4">
        <p className="text-sm mb-1">
          LINEのお名前：<span className="font-medium">{profile?.displayName || "…"}</span>
        </p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-subtle break-all flex-1">
            ID: {profile ? profile.userId : "取得中…"}
          </p>
          <button
            onClick={copyId}
            className="text-xs text-info flex items-center gap-1 shrink-0"
            disabled={!profile}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "コピー済" : "コピー"}
          </button>
        </div>
      </Card>

      {state === "pending" ? (
        <Card>
          <p className="text-sm text-success font-medium mb-1">申請しました</p>
          <p className="text-xs text-muted mb-4">
            管理者が承認すると使えるようになります。承認後にこのボタンで再確認してください。
          </p>
          <Button onClick={() => location.reload()} className="flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" /> 承認されたか確認する
          </Button>
        </Card>
      ) : (
        <Button onClick={apply} loading={state === "sending"} loadingText="申請中…" disabled={!profile}>
          利用を申請する
        </Button>
      )}

      {msg && <p className="text-danger text-sm mt-3">{msg}</p>}
      <p className="text-xs text-subtle mt-6">
        承認が届かないときは、上のIDをコピーして管理者に送ってください。
      </p>
    </main>
  );
}

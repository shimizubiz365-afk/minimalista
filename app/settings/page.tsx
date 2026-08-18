"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { UserRound, ChevronRight, Check, UserPlus } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";

type Me = { id: string; name: string; line_user_id: string; active: boolean };
type Staff = { id: string; name: string };

const links = [
  { href: "/settings/tk", label: "TK（総代理店）" },
  { href: "/settings/ambassadors", label: "アンバサダー" },
  { href: "/settings/fees", label: "フィー率" },
  { href: "/fees", label: "フィー台帳" },
];

export default function SettingsPage() {
  const [me, setMe] = useState<Me>();
  const [pending, setPending] = useState<Staff[]>([]);
  const [approving, setApproving] = useState<string>();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<Me>("/api/me").then((r) => {
      if (r.ok && r.data) {
        setMe(r.data);
        setName(r.data.name);
      }
    });
    loadPending();
  }, []);

  async function loadPending() {
    const r = await apiFetch<Staff[]>("/api/staff?status=pending");
    if (r.ok) setPending(r.data ?? []);
  }

  // 承認 = active を true に。これで初めてそのスタッフのAPIが通るようになる。
  async function approve(id: string) {
    setApproving(id);
    const r = await apiFetch(`/api/staff/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: true }),
    });
    setApproving(undefined);
    if (r.ok) loadPending();
  }

  async function saveName() {
    if (!name.trim() || name.trim() === me?.name) return;
    setSaving(true);
    setSaved(false);
    const r = await apiFetch<{ name: string }>("/api/me", {
      method: "PATCH",
      body: JSON.stringify({ name: name.trim() }),
    });
    setSaving(false);
    if (r.ok) {
      setSaved(true);
      setMe((m) => (m ? { ...m, name: name.trim() } : m));
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <main className="pb-10">
      <AppHeader title="設定" backHref="/" />

      {/* あなたのアカウント */}
      <section className="px-5 pt-6">
        <h2 className="text-sm font-semibold text-muted mb-3 flex items-center gap-1.5">
          <UserRound className="w-4 h-4" /> あなたのアカウント
        </h2>
        <Card>
          <label className="text-sm text-muted mb-1 block">表示名（書類の「担当」に表示）</label>
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="お名前"
            />
            <Button
              onClick={saveName}
              loading={saving}
              loadingText=""
              disabled={!name.trim() || name.trim() === me?.name}
              className="w-auto px-4"
            >
              {saved ? <Check className="w-5 h-5" /> : "保存"}
            </Button>
          </div>
          <p className="text-xs text-subtle mt-3">
            {me ? (
              <>
                LINE連携：済み{me.line_user_id ? `（…${me.line_user_id.slice(-6)}）` : ""}・
                {me.active ? "有効" : "停止中"}
              </>
            ) : (
              "読み込み中…"
            )}
          </p>
        </Card>
      </section>

      {/* 承認待ちスタッフ（申請があるときだけ出す） */}
      {pending.length > 0 && (
        <section className="px-5 pt-6">
          <h2 className="text-sm font-semibold text-muted mb-3 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4" /> 承認待ちのスタッフ {pending.length}件
          </h2>
          <div className="space-y-2">
            {pending.map((p) => (
              <Card key={p.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{p.name}</span>
                  <Button
                    onClick={() => approve(p.id)}
                    loading={approving === p.id}
                    loadingText=""
                    className="w-auto px-4 h-10 text-sm"
                  >
                    承認する
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          <p className="text-xs text-subtle mt-2">
            承認するとそのスタッフはアプリを使えるようになります。
          </p>
        </section>
      )}

      {/* 管理メニュー */}
      <section className="px-5 pt-6">
        <h2 className="text-sm font-semibold text-muted mb-3">管理</h2>
        <div className="space-y-2">
          {links.map((l) => (
            <Card key={l.href}>
              <Link href={l.href} className="flex items-center justify-between">
                <span className="text-sm font-medium">{l.label}</span>
                <ChevronRight className="w-5 h-5 text-subtle" />
              </Link>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

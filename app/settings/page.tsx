"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { UserRound, ChevronRight, Check } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";

type Me = { id: string; name: string; line_user_id: string; active: boolean };

const links = [
  { href: "/settings/tk", label: "TK（総代理店）" },
  { href: "/settings/ambassadors", label: "アンバサダー" },
  { href: "/settings/fees", label: "フィー率" },
  { href: "/fees", label: "フィー台帳" },
];

export default function SettingsPage() {
  const [me, setMe] = useState<Me>();
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
  }, []);

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

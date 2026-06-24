"use client";

import { useEffect, useState } from "react";
import liff from "@line/liff";
import Link from "next/link";
import { ArrowRight, Phone, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

type CaseRow = {
  id: string;
  status: string;
  visit_at: string | null;
  area: string | null;
  desired_items: string | null;
  source: string | null;
  customer: { name: string; phone: string | null } | null;
};

const SOURCE_LABEL: Record<string, string> = {
  phone: "電話",
  line: "LINE",
  email: "メール",
  referral: "紹介",
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function formatDate() {
  const d = new Date();
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${days[d.getDay()]}`;
}

function timeOf(visitAt: string | null) {
  if (!visitAt) return null;
  const m = visitAt.match(/T?(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

export default function Home() {
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string>();

  useEffect(() => {
    apiFetch<CaseRow[]>("/api/cases").then((r) =>
      r.ok ? setRows(r.data ?? []) : setErr(r.error)
    );
    liff
      .getProfile()
      .then((p) => setName(p.displayName ?? ""))
      .catch(() => {});
  }, []);

  const tk = todayKey();
  const todays = rows.filter((c) => c.visit_at?.startsWith(tk));
  const doneToday = todays.filter((c) => c.status === "closed").length;
  const pending = rows.filter((c) => !c.visit_at && c.status === "reserved");

  const initial = name ? name.slice(0, 1) : "−";

  return (
    <main>
      <AppHeader
        showLogo
        right={
          <span className="w-9 h-9 rounded-full bg-border flex items-center justify-center text-sm font-medium text-muted">
            {initial}
          </span>
        }
      />

      {/* 挨拶 */}
      <section className="px-5 pt-8 pb-5">
        <p className="text-sm text-muted mb-1">{formatDate()}</p>
        <h1 className="text-2xl font-semibold leading-tight">
          おはようございます{name && <>、{name}さん</>}
        </h1>
      </section>

      {/* 本日の進捗 */}
      <section className="px-5 pb-6">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-muted">本日の訪問</span>
          <span className="font-medium">
            <span className="text-primary">{doneToday}</span>
            <span className="text-muted">/{todays.length} 完了</span>
          </span>
        </div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{
              width: todays.length
                ? `${(doneToday / todays.length) * 100}%`
                : "0%",
            }}
          />
        </div>
      </section>

      <div className="border-t border-border mx-5" />

      {err && <p className="px-5 pt-4 text-danger text-sm">{err}</p>}

      {/* 今日の訪問 */}
      <section className="px-5 pt-6 pb-2">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg font-semibold">今日の訪問</h2>
          <span className="text-sm text-muted">{todays.length}件</span>
        </div>

        {todays.length === 0 && (
          <p className="text-sm text-subtle py-6 text-center">
            本日の予定はありません
          </p>
        )}

        {todays.map((c) => {
          const t = timeOf(c.visit_at);
          return (
            <Card key={c.id} href={`/cases/${c.id}`} className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                {t && <span className="text-base font-semibold">{t}</span>}
                <StatusBadge status={c.status} />
                {c.source && SOURCE_LABEL[c.source] && (
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-info/15 text-info font-medium">
                    {SOURCE_LABEL[c.source]}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-semibold mb-1">
                {c.customer?.name ?? "（顧客未設定）"} 様
              </h3>
              {c.area && <p className="text-sm mb-1 text-muted">{c.area}</p>}
              {c.desired_items && (
                <p className="text-xs text-muted mb-4">{c.desired_items}</p>
              )}
              <div className="w-full h-12 text-white rounded-md font-medium text-base flex items-center justify-center gap-2 bg-primary">
                案件を開く <ArrowRight className="w-4 h-4" />
              </div>
            </Card>
          );
        })}
      </section>

      {/* 要対応 */}
      {pending.length > 0 && (
        <>
          <div className="border-t border-border mx-5 my-4" />
          <section className="px-5 pb-2">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-semibold">要対応</h2>
              <span className="text-sm text-muted">{pending.length}件</span>
            </div>
            {pending.map((c) => (
              <Card key={c.id} className="mb-3">
                <Link
                  href={`/cases/${c.id}`}
                  className="flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-warning mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse-dot" />
                      日程未確定
                    </div>
                    <h3 className="text-lg font-semibold mb-1">
                      {c.customer?.name ?? "（顧客未設定）"} 様
                    </h3>
                    {c.desired_items && (
                      <p className="text-xs text-muted">{c.desired_items}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-subtle shrink-0 mt-0.5" />
                </Link>
                {c.customer?.phone && (
                  <a
                    href={`tel:${c.customer.phone}`}
                    className="mt-3 w-full h-12 text-white rounded-md font-medium text-base flex items-center justify-center gap-2 bg-warning active:bg-warning/90"
                  >
                    <Phone className="w-4 h-4" /> {c.customer.phone} に電話
                  </a>
                )}
              </Card>
            ))}
          </section>
        </>
      )}

      {/* クイックリンク */}
      <section className="px-5 pt-4 pb-8 grid grid-cols-2 gap-3">
        <Card href="/cases" className="text-center">
          <span className="text-sm font-medium">案件一覧</span>
        </Card>
        <Card href="/products" className="text-center">
          <span className="text-sm font-medium">在庫一覧</span>
        </Card>
        <Card href="/fees" className="text-center">
          <span className="text-sm font-medium">フィー台帳</span>
        </Card>
        <Card href="/cases/new" className="text-center">
          <span className="text-sm font-medium text-primary">＋ 予約登録</span>
        </Card>
      </section>
    </main>
  );
}

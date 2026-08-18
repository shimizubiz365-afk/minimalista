"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/cn";
import { CASE_STATUS_FLOW, CASE_STATUS_LABELS, label } from "@/lib/labels";

type CaseRow = {
  id: string;
  status: string;
  visit_at: string | null;
  area: string | null;
  customer: { name: string; phone: string | null } | null;
};
// タブ = ステータスの進み順そのもの（lib/labels.ts の CASE_STATUS_FLOW が正）
const TABS = CASE_STATUS_FLOW.map((v) => [v, label(CASE_STATUS_LABELS, v)] as const);

function fmtVisit(v: string | null) {
  if (!v) return "日時未定";
  const m = v.match(/(\d{4})-(\d{2})-(\d{2})T?(\d{2})?:?(\d{2})?/);
  if (!m) return v;
  const [, , mo, d, h, mi] = m;
  return h ? `${+mo}/${+d} ${h}:${mi}` : `${+mo}/${+d}`;
}

export default function CasesPage() {
  const [tab, setTab] = useState<string>("reserved");
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [err, setErr] = useState<string>();

  useEffect(() => {
    apiFetch<CaseRow[]>(`/api/cases?status=${tab}`).then((r) =>
      r.ok ? setRows(r.data ?? []) : setErr(r.error)
    );
  }, [tab]);

  return (
    <main>
      <AppHeader
        title="案件一覧"
        right={
          <Link
            href="/cases/new"
            className="h-9 px-3 rounded-md bg-primary text-white text-sm font-medium flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> 予約
          </Link>
        }
      />

      {/* タブ（横スクロール。数が増えても潰れない） */}
      <div className="px-5 pt-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {TABS.map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors shrink-0",
              tab === v
                ? "bg-primary text-white"
                : "bg-surface border border-border text-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {err && <p className="px-5 pt-4 text-danger text-sm">{err}</p>}

      <section className="px-5 pt-4 space-y-3">
        {rows.map((c) => (
          <Card key={c.id} href={`/cases/${c.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="mb-1.5">
                  <StatusBadge status={c.status} />
                </div>
                <h3 className="text-base font-semibold mb-0.5">
                  {c.customer?.name ?? "（顧客未設定）"} 様
                </h3>
                <p className="text-sm text-muted">
                  {fmtVisit(c.visit_at)}
                  {c.area ? `・${c.area}` : ""}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-subtle shrink-0 mt-1" />
            </div>
          </Card>
        ))}
        {rows.length === 0 && !err && (
          <p className="py-10 text-center text-subtle text-sm">該当なし</p>
        )}
      </section>
    </main>
  );
}

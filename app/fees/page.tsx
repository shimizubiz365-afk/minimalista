"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { formatYen } from "@/lib/money";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type Fee = {
  id: string;
  fee_total: number;
  pay_to: string;
  tk_portion: number | null;
  ambassador_portion: number | null;
  status: string;
  ambassador: { name: string } | null;
  tk: { name: string } | null;
};
const TABS = [
  ["accrued", "未払い"],
  ["paid", "支払済"],
] as const;

export default function FeesPage() {
  const [tab, setTab] = useState("accrued");
  const [rows, setRows] = useState<Fee[]>([]);
  const [msg, setMsg] = useState<string>();
  async function load() {
    const r = await apiFetch<Fee[]>(`/api/referral-fees?status=${tab}`);
    if (r.ok) setRows(r.data ?? []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  async function pay(id: string) {
    const r = await apiFetch(`/api/referral-fees/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "paid" }),
    });
    if (r.ok) load();
    else setMsg(r.error);
  }
  const total = rows.reduce((a, f) => a + f.fee_total, 0);
  return (
    <main>
      <AppHeader title="フィー台帳" backHref="/settings" />
      <div className="px-5 pt-4 flex gap-2">
        {TABS.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              tab === v
                ? "bg-primary text-white"
                : "bg-surface border border-border text-muted"
            )}
          >
            {l}
          </button>
        ))}
      </div>

      <section className="px-5 pt-4">
        <Card className="bg-bg">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted">合計</span>
            <span className="text-lg font-semibold">{formatYen(total)}</span>
          </div>
        </Card>
      </section>

      {msg && <p className="px-5 pt-3 text-danger text-sm">{msg}</p>}

      <section className="px-5 pt-3 space-y-3">
        {rows.map((f) => (
          <Card key={f.id}>
            <div className="flex justify-between items-start">
              <span className="text-sm">
                支払先:{" "}
                {f.pay_to === "tk"
                  ? `TK ${f.tk?.name ?? ""}`
                  : `${f.ambassador?.name ?? ""}（直）`}
              </span>
              <b className="text-base">{formatYen(f.fee_total)}</b>
            </div>
            <p className="text-xs text-muted mt-1">
              紹介: {f.ambassador?.name ?? "-"} ／ 内訳 TK
              {formatYen(f.tk_portion ?? 0)}・アンバ
              {formatYen(f.ambassador_portion ?? 0)}
            </p>
            {f.status === "accrued" && (
              <button
                onClick={() => pay(f.id)}
                className="mt-3 h-10 px-4 rounded-md bg-success text-white text-sm font-medium flex items-center gap-1.5 active:bg-success/90"
              >
                <Check className="w-4 h-4" /> 支払済にする
              </button>
            )}
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="py-10 text-center text-subtle text-sm">該当なし</p>
        )}
      </section>
    </main>
  );
}

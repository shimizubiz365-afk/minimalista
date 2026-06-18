"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/liffClient";
import { formatYen } from "@/lib/money";

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
    <main className="p-4 space-y-4">
      <h1 className="text-lg font-bold">フィー台帳</h1>
      <div className="flex gap-2">
        {TABS.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-3 py-1 rounded ${tab === v ? "bg-black text-white" : "bg-gray-200"}`}
          >
            {l}
          </button>
        ))}
      </div>
      <p className="text-sm">
        合計: <b>{formatYen(total)}</b>
      </p>
      {msg && <p className="text-red-600">{msg}</p>}
      <ul className="divide-y">
        {rows.map((f) => (
          <li key={f.id} className="py-2 text-sm">
            <div className="flex justify-between">
              <span>
                支払先:{" "}
                {f.pay_to === "tk" ? `TK ${f.tk?.name ?? ""}` : `${f.ambassador?.name ?? ""}（直）`}
              </span>
              <b>{formatYen(f.fee_total)}</b>
            </div>
            <div className="text-xs text-gray-500">
              紹介: {f.ambassador?.name ?? "-"} ／ 内訳 TK{formatYen(f.tk_portion ?? 0)}・アンバ
              {formatYen(f.ambassador_portion ?? 0)}
            </div>
            {f.status === "accrued" && (
              <button
                onClick={() => pay(f.id)}
                className="mt-1 bg-green-700 text-white px-3 py-1 rounded text-xs"
              >
                支払済にする
              </button>
            )}
          </li>
        ))}
        {rows.length === 0 && <li className="py-6 text-gray-400">該当なし</li>}
      </ul>
    </main>
  );
}

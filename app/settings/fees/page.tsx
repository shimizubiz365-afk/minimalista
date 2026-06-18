"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/liffClient";

type Fee = {
  id: string;
  rate_buy: number;
  rate_work: number;
  tk_share: number;
  ambassador_share: number;
  effective_from: string;
};

export default function FeesPage() {
  const [rows, setRows] = useState<Fee[]>([]);
  const [form, setForm] = useState({
    rate_buy: "0.05",
    rate_work: "0.1",
    tk_share: "0.6",
    ambassador_share: "0.4",
    effective_from: "",
  });
  const [msg, setMsg] = useState<string>();
  async function load() {
    const r = await apiFetch<Fee[]>("/api/fee-settings");
    if (r.ok) setRows(r.data ?? []);
  }
  useEffect(() => {
    load();
  }, []);
  async function add() {
    if (!form.effective_from) {
      setMsg("適用開始日は必須");
      return;
    }
    const r = await apiFetch("/api/fee-settings", {
      method: "POST",
      body: JSON.stringify({
        rate_buy: parseFloat(form.rate_buy),
        rate_work: parseFloat(form.rate_work),
        tk_share: parseFloat(form.tk_share),
        ambassador_share: parseFloat(form.ambassador_share),
        effective_from: form.effective_from,
      }),
    });
    if (r.ok) load();
    else setMsg(r.error);
  }
  return (
    <main className="p-4 space-y-3">
      <h1 className="text-lg font-bold">フィー率設定</h1>
      <p className="text-xs text-gray-500">
        率は小数（5% = 0.05）。ambassador_share は参考値（計算は tk_share の残差）。
      </p>
      <label className="text-sm block">
        買取料率
        <input
          className="border p-2 w-full"
          value={form.rate_buy}
          onChange={(e) => setForm({ ...form, rate_buy: e.target.value })}
        />
      </label>
      <label className="text-sm block">
        作業費料率
        <input
          className="border p-2 w-full"
          value={form.rate_work}
          onChange={(e) => setForm({ ...form, rate_work: e.target.value })}
        />
      </label>
      <label className="text-sm block">
        TK取り分
        <input
          className="border p-2 w-full"
          value={form.tk_share}
          onChange={(e) => setForm({ ...form, tk_share: e.target.value })}
        />
      </label>
      <label className="text-sm block">
        アンバサダー取り分(参考)
        <input
          className="border p-2 w-full"
          value={form.ambassador_share}
          onChange={(e) => setForm({ ...form, ambassador_share: e.target.value })}
        />
      </label>
      <label className="text-sm block">
        適用開始日
        <input
          className="border p-2 w-full"
          type="date"
          value={form.effective_from}
          onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
        />
      </label>
      {msg && <p className="text-red-600">{msg}</p>}
      <button onClick={add} className="bg-black text-white w-full py-2 rounded">
        この率を追加
      </button>
      <ul className="divide-y text-sm">
        {rows.map((f) => (
          <li key={f.id} className="py-2">
            {f.effective_from}〜 買{f.rate_buy}/作{f.rate_work}/TK{f.tk_share}
          </li>
        ))}
      </ul>
    </main>
  );
}

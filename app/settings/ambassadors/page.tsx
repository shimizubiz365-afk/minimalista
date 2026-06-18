"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/liffClient";

type Tk = { id: string; name: string };
type Amb = { id: string; name: string; route_code: string; tk: { name: string } | null };

export default function AmbassadorsPage() {
  const [rows, setRows] = useState<Amb[]>([]);
  const [tks, setTks] = useState<Tk[]>([]);
  const [form, setForm] = useState({ name: "", route_code: "", tk_id: "" });
  const [msg, setMsg] = useState<string>();
  async function load() {
    const r = await apiFetch<Amb[]>("/api/ambassadors");
    if (r.ok) setRows(r.data ?? []);
    const t = await apiFetch<Tk[]>("/api/tk");
    if (t.ok) setTks(t.data ?? []);
  }
  useEffect(() => {
    load();
  }, []);
  async function add() {
    if (!form.name || !form.route_code) {
      setMsg("名前と紹介コードは必須");
      return;
    }
    const r = await apiFetch("/api/ambassadors", {
      method: "POST",
      body: JSON.stringify({ name: form.name, route_code: form.route_code, tk_id: form.tk_id || null }),
    });
    if (r.ok) {
      setForm({ name: "", route_code: "", tk_id: "" });
      load();
    } else setMsg(r.error);
  }
  return (
    <main className="p-4 space-y-3">
      <h1 className="text-lg font-bold">アンバサダー</h1>
      <input
        className="border p-2 w-full"
        placeholder="名前"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <input
        className="border p-2 w-full"
        placeholder="紹介コード（route_code）"
        value={form.route_code}
        onChange={(e) => setForm({ ...form, route_code: e.target.value })}
      />
      <select
        className="border p-2 w-full"
        value={form.tk_id}
        onChange={(e) => setForm({ ...form, tk_id: e.target.value })}
      >
        <option value="">直（TKなし）</option>
        {tks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {msg && <p className="text-red-600">{msg}</p>}
      <button onClick={add} className="bg-black text-white w-full py-2 rounded">
        アンバサダーを追加
      </button>
      <ul className="divide-y">
        {rows.map((a) => (
          <li key={a.id} className="py-2">
            {a.name}（{a.route_code}）/ {a.tk?.name ?? "直"}
          </li>
        ))}
      </ul>
    </main>
  );
}

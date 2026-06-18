"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/liffClient";

type Tk = { id: string; name: string; contact: string | null };

export default function TkPage() {
  const [rows, setRows] = useState<Tk[]>([]);
  const [form, setForm] = useState({ name: "", contact: "", payment_info: "" });
  const [msg, setMsg] = useState<string>();
  async function load() {
    const r = await apiFetch<Tk[]>("/api/tk");
    if (r.ok) setRows(r.data ?? []);
  }
  useEffect(() => {
    load();
  }, []);
  async function add() {
    if (!form.name) {
      setMsg("名前は必須");
      return;
    }
    const r = await apiFetch("/api/tk", { method: "POST", body: JSON.stringify(form) });
    if (r.ok) {
      setForm({ name: "", contact: "", payment_info: "" });
      load();
    } else setMsg(r.error);
  }
  return (
    <main className="p-4 space-y-3">
      <h1 className="text-lg font-bold">TK（統括）</h1>
      <input
        className="border p-2 w-full"
        placeholder="名前"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <input
        className="border p-2 w-full"
        placeholder="連絡先"
        value={form.contact}
        onChange={(e) => setForm({ ...form, contact: e.target.value })}
      />
      <input
        className="border p-2 w-full"
        placeholder="振込先など"
        value={form.payment_info}
        onChange={(e) => setForm({ ...form, payment_info: e.target.value })}
      />
      {msg && <p className="text-red-600">{msg}</p>}
      <button onClick={add} className="bg-black text-white w-full py-2 rounded">
        TKを追加
      </button>
      <ul className="divide-y">
        {rows.map((t) => (
          <li key={t.id} className="py-2">
            {t.name}（{t.contact ?? "-"}）
          </li>
        ))}
      </ul>
    </main>
  );
}

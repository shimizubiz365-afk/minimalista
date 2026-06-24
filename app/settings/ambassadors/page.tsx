"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

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
    <main>
      <AppHeader title="アンバサダー" backHref="/settings" />
      <section className="px-5 pt-6 space-y-4">
        <Card>
          <div className="space-y-3">
            <Field label="名前" required>
              <input
                className={inputClass}
                placeholder="名前"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="紹介コード（route_code）" required>
              <input
                className={inputClass}
                placeholder="紹介コード（route_code）"
                value={form.route_code}
                onChange={(e) => setForm({ ...form, route_code: e.target.value })}
              />
            </Field>
            <Field label="所属TK">
              <select
                className={inputClass}
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
            </Field>
            {msg && <p className="text-danger text-sm">{msg}</p>}
            <Button onClick={add}>
              <Plus className="w-4 h-4" /> アンバサダーを追加
            </Button>
          </div>
        </Card>

        <div className="space-y-3">
          {rows.map((a) => (
            <Card key={a.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{a.name}</span>
                <span className="text-xs text-muted">{a.tk?.name ?? "直"}</span>
              </div>
              <p className="text-xs text-muted mt-0.5">{a.route_code}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

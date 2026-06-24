"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

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
    <main>
      <AppHeader title="TK（総代理店）" backHref="/settings" />
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
            <Field label="連絡先">
              <input
                className={inputClass}
                placeholder="連絡先"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
              />
            </Field>
            <Field label="振込先など">
              <input
                className={inputClass}
                placeholder="振込先など"
                value={form.payment_info}
                onChange={(e) => setForm({ ...form, payment_info: e.target.value })}
              />
            </Field>
            {msg && <p className="text-danger text-sm">{msg}</p>}
            <Button onClick={add}>
              <Plus className="w-4 h-4" /> TKを追加
            </Button>
          </div>
        </Card>

        <div className="space-y-3">
          {rows.map((t) => (
            <Card key={t.id}>
              <span className="text-sm font-medium">{t.name}</span>
              <span className="text-sm text-muted">（{t.contact ?? "-"}）</span>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

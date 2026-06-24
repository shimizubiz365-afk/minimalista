"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

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
    <main>
      <AppHeader title="フィー率" backHref="/settings" />
      <section className="px-5 pt-6 space-y-4">
        <p className="text-xs text-muted">
          率は小数（5% = 0.05）。ambassador_share は参考値（計算は tk_share の残差）。
        </p>
        <Card>
          <div className="space-y-3">
            <Field label="買取料率">
              <input
                className={inputClass}
                value={form.rate_buy}
                onChange={(e) => setForm({ ...form, rate_buy: e.target.value })}
              />
            </Field>
            <Field label="作業費料率">
              <input
                className={inputClass}
                value={form.rate_work}
                onChange={(e) => setForm({ ...form, rate_work: e.target.value })}
              />
            </Field>
            <Field label="TK取り分">
              <input
                className={inputClass}
                value={form.tk_share}
                onChange={(e) => setForm({ ...form, tk_share: e.target.value })}
              />
            </Field>
            <Field label="アンバサダー取り分(参考)">
              <input
                className={inputClass}
                value={form.ambassador_share}
                onChange={(e) =>
                  setForm({ ...form, ambassador_share: e.target.value })
                }
              />
            </Field>
            <Field label="適用開始日" required>
              <input
                className={inputClass}
                type="date"
                value={form.effective_from}
                onChange={(e) =>
                  setForm({ ...form, effective_from: e.target.value })
                }
              />
            </Field>
            {msg && <p className="text-danger text-sm">{msg}</p>}
            <Button onClick={add}>
              <Plus className="w-4 h-4" /> この率を追加
            </Button>
          </div>
        </Card>

        <div className="space-y-3">
          {rows.map((f) => (
            <Card key={f.id}>
              <p className="text-sm font-medium">{f.effective_from}〜</p>
              <p className="text-xs text-muted mt-0.5">
                買{f.rate_buy}／作{f.rate_work}／TK{f.tk_share}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

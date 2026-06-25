"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";

type Cust = {
  id: string;
  customer_no: string;
  name: string;
  phone: string | null;
  address: string | null;
};

export default function NewCasePage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [candidates, setCandidates] = useState<Cust[]>([]);
  const [existingId, setExistingId] = useState<string>();
  const [form, setForm] = useState({
    name: "",
    name_kana: "",
    address: "",
    visit_at: "",
    area: "",
    desired_items: "",
    source: "phone",
  });
  const [err, setErr] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [ambassadors, setAmbassadors] = useState<{ id: string; name: string }[]>([]);
  const [ambId, setAmbId] = useState("");

  useEffect(() => {
    apiFetch<{ id: string; name: string }[]>("/api/ambassadors").then(
      (r) => r.ok && setAmbassadors(r.data ?? [])
    );
  }, []);

  async function search() {
    if (!phone.trim()) return;
    const r = await apiFetch<Cust[]>(`/api/customers/search?phone=${encodeURIComponent(phone)}`);
    if (r.ok) setCandidates(r.data ?? []);
  }
  function pick(c: Cust) {
    setExistingId(c.id);
    setForm((f) => ({ ...f, name: c.name, address: c.address ?? "" }));
  }
  async function submit() {
    const body = {
      customer: existingId
        ? { existing_id: existingId }
        : { name: form.name, name_kana: form.name_kana, phone, address: form.address },
      visit_at: form.visit_at || null,
      area: form.area,
      desired_items: form.desired_items,
      source: form.source,
      referrer_ambassador_id: form.source === "referral" ? ambId || null : null,
    };
    setErr(undefined);
    setSaving(true);
    try {
      const r = await apiFetch<{ id: string }>("/api/cases", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (r.ok) router.push(`/cases/${r.data!.id}`);
      else setErr(r.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <AppHeader title="予約登録" backHref="/cases" />
      <section className="px-5 pt-6 space-y-4">
        <Field label="電話番号">
          <div className="flex gap-2">
            <input
              className={cn(inputClass, "flex-1")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={search}
            />
            <button
              onClick={search}
              className="h-12 px-4 rounded-md border border-border bg-surface text-fg flex items-center gap-1 active:bg-border/40"
            >
              <Search className="w-4 h-4" /> 検索
            </button>
          </div>
        </Field>

        {candidates.length > 0 && (
          <Card className="bg-accent/10 border-accent/30">
            <p className="text-sm font-medium mb-2">
              同じ電話番号の既存顧客（選ぶと紐付け）
            </p>
            {candidates.map((c) => (
              <button
                key={c.id}
                onClick={() => pick(c)}
                className={cn(
                  "block w-full text-left py-1.5 text-sm",
                  existingId === c.id && "font-bold text-primary"
                )}
              >
                {c.customer_no} {c.name}（{c.address ?? "住所未登録"}）
              </button>
            ))}
            <button
              onClick={() => setExistingId(undefined)}
              className="text-info text-sm mt-1"
            >
              新規として登録する
            </button>
          </Card>
        )}

        <Field label="氏名">
          <input
            className={inputClass}
            placeholder="氏名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            disabled={!!existingId}
          />
        </Field>
        <Field label="フリガナ">
          <input
            className={inputClass}
            placeholder="フリガナ"
            value={form.name_kana}
            onChange={(e) => setForm({ ...form, name_kana: e.target.value })}
            disabled={!!existingId}
          />
        </Field>
        <Field label="住所">
          <input
            className={inputClass}
            placeholder="住所"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            disabled={!!existingId}
          />
        </Field>
        <Field label="訪問日時">
          <input
            className={inputClass}
            type="datetime-local"
            value={form.visit_at}
            onChange={(e) => setForm({ ...form, visit_at: e.target.value })}
          />
        </Field>
        <Field label="エリア">
          <input
            className={inputClass}
            placeholder="エリア"
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
          />
        </Field>
        <Field label="希望品目">
          <input
            className={inputClass}
            placeholder="希望品目"
            value={form.desired_items}
            onChange={(e) => setForm({ ...form, desired_items: e.target.value })}
          />
        </Field>
        <Field label="流入経路">
          <select
            className={inputClass}
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
          >
            <option value="phone">電話</option>
            <option value="line">LINE</option>
            <option value="email">メール</option>
            <option value="referral">紹介</option>
          </select>
        </Field>
        {form.source === "referral" && (
          <Field label="紹介アンバサダー">
            <select
              className={inputClass}
              value={ambId}
              onChange={(e) => setAmbId(e.target.value)}
            >
              <option value="">紹介アンバサダーを選択</option>
              {ambassadors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {err && <p className="text-danger text-sm">{err}</p>}
        <Button onClick={submit} size="lg" loading={saving} loadingText="登録中...">
          登録して案件を開く <ArrowRight className="w-4 h-4" />
        </Button>
      </section>
    </main>
  );
}

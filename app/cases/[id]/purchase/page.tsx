"use client";
import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { useDraft } from "@/lib/draft";
import { DraftBanner } from "@/components/draft-banner";

export default function PurchaseInput({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [form, setForm] = useState({ name: "", brand: "", model: "", condition: "", amount: "" });
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string>();
  const [saving, setSaving] = useState(false);
  const draft = useDraft(`purchase:${id}`, form, setForm);

  // next=true なら保存後もこの画面に留まり、続けて次の品を入力できる
  async function save(next = false) {
    const amount = parseInt(form.amount, 10);
    if (!form.name || isNaN(amount)) {
      setMsg("品名と金額は必須");
      return;
    }
    setMsg(undefined);
    setSaving(true);
    try {
      const r = await apiFetch<{ id: string }>("/api/purchase-items", {
        method: "POST",
        body: JSON.stringify({
          case_id: id,
          name: form.name,
          brand: form.brand,
          model: form.model,
          condition: form.condition,
          amount,
        }),
      });
      if (!r.ok) {
        setMsg(r.error);
        return;
      }
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("case_id", id);
        fd.append("kind", "purchase");
        fd.append("purchase_item_id", r.data!.id);
        const m = await apiFetch("/api/media", { method: "POST", body: fd });
        if (!m.ok) {
          setMsg("明細は保存できたが写真の保存に失敗: " + m.error);
          return;
        }
      }
      draft.clear();
      if (next) {
        setForm({ name: "", brand: "", model: "", condition: "", amount: "" });
        setFile(null);
        setMsg("保存しました。続けて入力できます");
      } else {
        router.push(`/cases/${id}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <AppHeader title="買取入力" backHref={`/cases/${id}`} />
      {draft.restored && <DraftBanner onDiscard={draft.discard} />}
      <section className="px-5 pt-6 space-y-4">
        <Field label="品名" required>
          <input
            className={inputClass}
            placeholder="品名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="ブランド">
          <input
            className={inputClass}
            placeholder="ブランド"
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
          />
        </Field>
        <Field label="型番">
          <input
            className={inputClass}
            placeholder="型番"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
          />
        </Field>
        <Field label="状態">
          <input
            className={inputClass}
            placeholder="状態"
            value={form.condition}
            onChange={(e) => setForm({ ...form, condition: e.target.value })}
          />
        </Field>
        <Field label="買取額（円）" required>
          <input
            className={inputClass}
            type="number"
            inputMode="numeric"
            placeholder="買取額（円）"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </Field>
        <Field label="写真">
          <label className="w-full border border-border rounded-md px-3 h-12 bg-surface text-muted flex items-center gap-2 cursor-pointer active:bg-border/40">
            <Camera className="w-4 h-4" />
            <span className="text-sm truncate">
              {file ? file.name : "写真を撮影 / 選択"}
            </span>
            <input
              className="hidden"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </Field>
        {msg && <p className="text-danger text-sm">{msg}</p>}
        <Button
          variant="secondary"
          onClick={() => save(true)}
          loading={saving}
          loadingText="保存中..."
        >
          保存して次を入力
        </Button>
        <Button onClick={() => save(false)} size="lg" loading={saving} loadingText="保存中...">
          保存
        </Button>
      </section>
    </main>
  );
}

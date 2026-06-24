"use client";
import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

export default function CollectionInput({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [form, setForm] = useState({ item_name: "", work_fee: "" });
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string>();

  async function save() {
    const work_fee = parseInt(form.work_fee, 10);
    if (!form.item_name || isNaN(work_fee)) {
      setMsg("品目と作業費は必須");
      return;
    }
    setMsg("保存中...");
    const r = await apiFetch<{ id: string }>("/api/collection-items", {
      method: "POST",
      body: JSON.stringify({ case_id: id, item_name: form.item_name, work_fee }),
    });
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("case_id", id);
      fd.append("kind", "collection");
      fd.append("collection_item_id", r.data!.id);
      const m = await apiFetch("/api/media", { method: "POST", body: fd });
      if (!m.ok) {
        setMsg("明細は保存できたが写真の保存に失敗: " + m.error);
        return;
      }
    }
    router.push(`/cases/${id}`);
  }

  return (
    <main>
      <AppHeader title="回収入力" backHref={`/cases/${id}`} />
      <section className="px-5 pt-6 space-y-4">
        <Field label="回収品目" required>
          <input
            className={inputClass}
            placeholder="回収品目"
            value={form.item_name}
            onChange={(e) => setForm({ ...form, item_name: e.target.value })}
          />
        </Field>
        <Field label="作業費（円）" required>
          <input
            className={inputClass}
            type="number"
            inputMode="numeric"
            placeholder="作業費（円）"
            value={form.work_fee}
            onChange={(e) => setForm({ ...form, work_fee: e.target.value })}
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
        <Button onClick={save} size="lg">
          保存
        </Button>
      </section>
    </main>
  );
}

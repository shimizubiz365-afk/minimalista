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
  // 値引き・サービスはマイナスの明細として入れる（スマホの数字キーに「−」が無いためトグルで符号を決める）
  const [sign, setSign] = useState<1 | -1>(1);
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsed = parseInt(form.work_fee, 10);
    const work_fee = isNaN(parsed) ? NaN : Math.abs(parsed) * sign;
    if (!form.item_name || isNaN(work_fee)) {
      setMsg("品目と作業費は必須");
      return;
    }
    setMsg(undefined);
    setSaving(true);
    try {
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <AppHeader title="作業依頼書 入力" backHref={`/cases/${id}`} />
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
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setSign(1)}
              className={`flex-1 h-9 rounded-md text-sm font-medium border ${
                sign === 1
                  ? "bg-primary text-white border-primary"
                  : "bg-surface text-fg border-border"
              }`}
            >
              請求（＋）
            </button>
            <button
              type="button"
              onClick={() => setSign(-1)}
              className={`flex-1 h-9 rounded-md text-sm font-medium border ${
                sign === -1
                  ? "bg-primary text-white border-primary"
                  : "bg-surface text-fg border-border"
              }`}
            >
              値引き・サービス（−）
            </button>
          </div>
          <input
            className={inputClass}
            type="number"
            inputMode="numeric"
            placeholder="作業費（円）"
            value={form.work_fee}
            onChange={(e) => setForm({ ...form, work_fee: e.target.value })}
          />
          <p className="text-xs text-subtle mt-1">
            {sign === -1
              ? "マイナスの明細として保存され、合計から差し引かれます。"
              : "金額はプラスで入力してください。"}
          </p>
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
        <Button onClick={save} size="lg" loading={saving} loadingText="保存中...">
          保存
        </Button>
      </section>
    </main>
  );
}

"use client";
import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/liffClient";

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
    <main className="p-4 space-y-3">
      <h1 className="text-lg font-bold">回収入力</h1>
      <input
        className="border p-2 w-full"
        placeholder="回収品目"
        value={form.item_name}
        onChange={(e) => setForm({ ...form, item_name: e.target.value })}
      />
      <input
        className="border p-2 w-full"
        type="number"
        inputMode="numeric"
        placeholder="作業費（円）"
        value={form.work_fee}
        onChange={(e) => setForm({ ...form, work_fee: e.target.value })}
      />
      <input
        className="border p-2 w-full"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {msg && <p className="text-red-600">{msg}</p>}
      <button onClick={save} className="bg-black text-white w-full py-3 rounded">
        保存
      </button>
    </main>
  );
}

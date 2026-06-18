"use client";
import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/liffClient";

export default function PurchaseInput({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [form, setForm] = useState({ name: "", brand: "", model: "", condition: "", amount: "" });
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string>();

  async function save() {
    const amount = parseInt(form.amount, 10);
    if (!form.name || isNaN(amount)) {
      setMsg("品名と金額は必須");
      return;
    }
    setMsg("保存中...");
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
    router.push(`/cases/${id}`);
  }

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-lg font-bold">買取入力</h1>
      <input
        className="border p-2 w-full"
        placeholder="品名"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <input
        className="border p-2 w-full"
        placeholder="ブランド"
        value={form.brand}
        onChange={(e) => setForm({ ...form, brand: e.target.value })}
      />
      <input
        className="border p-2 w-full"
        placeholder="型番"
        value={form.model}
        onChange={(e) => setForm({ ...form, model: e.target.value })}
      />
      <input
        className="border p-2 w-full"
        placeholder="状態"
        value={form.condition}
        onChange={(e) => setForm({ ...form, condition: e.target.value })}
      />
      <input
        className="border p-2 w-full"
        type="number"
        inputMode="numeric"
        placeholder="買取額（円）"
        value={form.amount}
        onChange={(e) => setForm({ ...form, amount: e.target.value })}
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

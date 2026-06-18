"use client";
import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/liffClient";

const METHODS = ["運転免許証", "マイナンバーカード", "在留カード", "パスポート", "その他"];

export default function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [method, setMethod] = useState(METHODS[0]);
  const [occupation, setOccupation] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string>();

  async function save() {
    const by = parseInt(birthYear, 10);
    if (!occupation || isNaN(by)) {
      setMsg("職業と生年（西暦）は必須");
      return;
    }
    setMsg("保存中...");
    let idMediaId: string | undefined;
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("case_id", id);
      fd.append("kind", "id_doc");
      const m = await apiFetch<{ id: string }>("/api/media", { method: "POST", body: fd });
      if (!m.ok) {
        setMsg("身分証写真の保存に失敗: " + m.error);
        return;
      }
      idMediaId = m.data!.id;
    }
    const r = await apiFetch(`/api/cases/${id}/verify`, {
      method: "POST",
      body: JSON.stringify({
        verification_method: method,
        occupation,
        birth_year: by,
        id_media_id: idMediaId,
      }),
    });
    if (r.ok) router.push(`/cases/${id}`);
    else setMsg(r.error);
  }

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-lg font-bold">本人確認</h1>
      <label className="block text-sm">確認方法</label>
      <select
        className="border p-2 w-full"
        value={method}
        onChange={(e) => setMethod(e.target.value)}
      >
        {METHODS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <input
        className="border p-2 w-full"
        placeholder="職業"
        value={occupation}
        onChange={(e) => setOccupation(e.target.value)}
      />
      <input
        className="border p-2 w-full"
        type="number"
        inputMode="numeric"
        placeholder="生年（西暦 例:1985）"
        value={birthYear}
        onChange={(e) => setBirthYear(e.target.value)}
      />
      <label className="block text-sm">身分証の写真</label>
      <input
        className="border p-2 w-full"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {msg && <p className="text-red-600">{msg}</p>}
      <button onClick={save} className="bg-black text-white w-full py-3 rounded">
        本人確認を保存
      </button>
    </main>
  );
}

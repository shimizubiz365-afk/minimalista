"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/liffClient";

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
    const r = await apiFetch<{ id: string }>("/api/cases", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (r.ok) router.push(`/cases/${r.data!.id}`);
    else setErr(r.error);
  }

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-lg font-bold">予約登録</h1>
      <label className="block text-sm">
        電話番号
        <div className="flex gap-2">
          <input
            className="border p-2 flex-1"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={search}
          />
          <button onClick={search} className="bg-gray-200 px-3 rounded">
            検索
          </button>
        </div>
      </label>
      {candidates.length > 0 && (
        <div className="border rounded p-2 bg-yellow-50 text-sm">
          <p className="font-medium">同じ電話番号の既存顧客（選ぶと紐付け）</p>
          {candidates.map((c) => (
            <button
              key={c.id}
              onClick={() => pick(c)}
              className={`block w-full text-left py-1 ${existingId === c.id ? "font-bold" : ""}`}
            >
              {c.customer_no} {c.name}（{c.address ?? "住所未登録"}）
            </button>
          ))}
          <button onClick={() => setExistingId(undefined)} className="text-blue-600 mt-1">
            新規として登録する
          </button>
        </div>
      )}
      <input
        className="border p-2 w-full"
        placeholder="氏名"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        disabled={!!existingId}
      />
      <input
        className="border p-2 w-full"
        placeholder="フリガナ"
        value={form.name_kana}
        onChange={(e) => setForm({ ...form, name_kana: e.target.value })}
        disabled={!!existingId}
      />
      <input
        className="border p-2 w-full"
        placeholder="住所"
        value={form.address}
        onChange={(e) => setForm({ ...form, address: e.target.value })}
        disabled={!!existingId}
      />
      <input
        className="border p-2 w-full"
        type="datetime-local"
        value={form.visit_at}
        onChange={(e) => setForm({ ...form, visit_at: e.target.value })}
      />
      <input
        className="border p-2 w-full"
        placeholder="エリア"
        value={form.area}
        onChange={(e) => setForm({ ...form, area: e.target.value })}
      />
      <input
        className="border p-2 w-full"
        placeholder="希望品目"
        value={form.desired_items}
        onChange={(e) => setForm({ ...form, desired_items: e.target.value })}
      />
      <select
        className="border p-2 w-full"
        value={form.source}
        onChange={(e) => setForm({ ...form, source: e.target.value })}
      >
        <option value="phone">電話</option>
        <option value="line">LINE</option>
        <option value="email">メール</option>
        <option value="referral">紹介</option>
      </select>
      {form.source === "referral" && (
        <select
          className="border p-2 w-full"
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
      )}
      {err && <p className="text-red-600">{err}</p>}
      <button onClick={submit} className="bg-black text-white w-full py-3 rounded">
        登録して案件を開く
      </button>
    </main>
  );
}

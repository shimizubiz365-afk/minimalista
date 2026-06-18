"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/liffClient";
import { formatYen } from "@/lib/money";

type Detail = {
  case: {
    id: string;
    status: string;
    visit_at: string | null;
    area: string | null;
    memo: string | null;
    verification_method: string | null;
  };
  customer: { name: string; customer_no: string; phone: string | null; address: string | null };
  purchase_items: { id: string; name: string; amount: number }[];
  collection_items: { id: string; item_name: string; work_fee: number }[];
};
const STATUSES = ["reserved", "visiting", "visited", "pending_pickup", "closed", "cancelled"];

export default function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Detail>();
  const [msg, setMsg] = useState<string>();
  const [pdfUrl, setPdfUrl] = useState<string>();
  const [cash, setCash] = useState("");

  async function load() {
    const r = await apiFetch<Detail>(`/api/cases/${id}`);
    if (r.ok) setD(r.data!);
    else setMsg(r.error);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function setStatus(status: string) {
    const r = await apiFetch(`/api/cases/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (r.ok) load();
    else setMsg(r.error);
  }
  async function issue(kind: "purchase-slip" | "receipt") {
    setMsg("発行中...");
    const r = await apiFetch<{ signed_url: string }>(`/api/documents/${kind}`, {
      method: "POST",
      body: JSON.stringify({ case_id: id }),
    });
    if (r.ok) {
      setPdfUrl(r.data!.signed_url);
      setMsg(undefined);
    } else setMsg(r.error);
  }
  async function settle() {
    const n = parseInt(cash, 10);
    if (isNaN(n)) {
      setMsg("受領/支払現金を入力してください");
      return;
    }
    setMsg("精算確定中...");
    const r = await apiFetch<{ daicho_count: number }>("/api/settlements", {
      method: "POST",
      body: JSON.stringify({ case_id: id, cash_settled: n }),
    });
    if (r.ok) {
      setMsg(`精算確定（台帳${r.data!.daicho_count}件生成）`);
      load();
    } else setMsg(r.error);
  }
  if (!d) return <main className="p-4">{msg ?? "読み込み中..."}</main>;

  const buyTotal = d.purchase_items.reduce((a, i) => a + i.amount, 0);
  const workTotal = d.collection_items.reduce((a, i) => a + i.work_fee, 0);

  return (
    <main className="p-4 space-y-4">
      <div>
        <h1 className="text-lg font-bold">
          {d.customer.name}（{d.customer.customer_no}）
        </h1>
        <p className="text-sm text-gray-500">
          {d.customer.phone}・{d.customer.address}
        </p>
        <p className="text-sm">
          訪問: {d.case.visit_at ?? "未定"}・{d.case.area}
        </p>
      </div>

      <div>
        <label className="text-sm">ステータス</label>
        <select
          className="border p-2 w-full"
          value={d.case.status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      <section>
        <h2 className="font-bold">本人確認</h2>
        {d.case.verification_method ? (
          <p className="text-sm text-green-700">確認済み（{d.case.verification_method}）</p>
        ) : (
          <Link href={`/cases/${id}/verify`} className="text-blue-600">
            本人確認を実施
          </Link>
        )}
      </section>

      <section>
        <div className="flex justify-between">
          <h2 className="font-bold">買取明細</h2>
          <Link className="text-blue-600" href={`/cases/${id}/purchase`}>
            ＋入力
          </Link>
        </div>
        {d.purchase_items.map((i) => (
          <div key={i.id} className="flex justify-between py-1 border-b">
            <span>{i.name}</span>
            <span>{formatYen(i.amount)}</span>
          </div>
        ))}
        <div className="text-right font-bold mt-1">買取合計 {formatYen(buyTotal)}</div>
        <button
          onClick={() => issue("purchase-slip")}
          className="mt-2 bg-black text-white w-full py-2 rounded disabled:opacity-40"
          disabled={d.purchase_items.length === 0}
        >
          買取伝票PDF発行
        </button>
      </section>

      <section>
        <div className="flex justify-between">
          <h2 className="font-bold">回収明細</h2>
          <Link className="text-blue-600" href={`/cases/${id}/collection`}>
            ＋入力
          </Link>
        </div>
        {d.collection_items.map((i) => (
          <div key={i.id} className="flex justify-between py-1 border-b">
            <span>{i.item_name}</span>
            <span>{formatYen(i.work_fee)}</span>
          </div>
        ))}
        <div className="text-right font-bold mt-1">作業費合計 {formatYen(workTotal)}</div>
        <button
          onClick={() => issue("receipt")}
          className="mt-2 bg-black text-white w-full py-2 rounded disabled:opacity-40"
          disabled={d.collection_items.length === 0}
        >
          領収書PDF発行
        </button>
      </section>

      <section className="border-t pt-3">
        <h2 className="font-bold">精算</h2>
        {d.case.status === "closed" ? (
          <p className="text-sm text-green-700">精算確定済み（クローズ）</p>
        ) : (
          <>
            <label className="text-sm">受領/支払 現金（円）</label>
            <input
              className="border p-2 w-full"
              type="number"
              inputMode="numeric"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              placeholder={`差引: ${formatYen(buyTotal - workTotal)}`}
            />
            <button
              onClick={settle}
              className="mt-2 bg-red-700 text-white w-full py-2 rounded"
            >
              精算を確定する（台帳生成・クローズ）
            </button>
          </>
        )}
      </section>

      {msg && <p className="text-red-600">{msg}</p>}
      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="block text-center bg-green-600 text-white py-3 rounded"
        >
          発行したPDFを開く
        </a>
      )}
    </main>
  );
}

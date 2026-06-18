"use client";
import { useEffect, useState, use } from "react";
import { apiFetch } from "@/lib/liffClient";
import { formatYen, grossProfit } from "@/lib/money";

type Detail = {
  product: { id: string; name: string; cost: number; status: string; condition: string | null };
  sale: {
    sale_price: number;
    gross_profit: number;
    channel: string | null;
    sold_at: string;
  } | null;
};
const CHANNELS = ["mercari", "ebay", "yahoo", "store", "other"];

export default function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Detail>();
  const [price, setPrice] = useState("");
  const [channel, setChannel] = useState("mercari");
  const [soldAt, setSoldAt] = useState("");
  const [msg, setMsg] = useState<string>();

  async function load() {
    const r = await apiFetch<Detail>(`/api/products/${id}`);
    if (r.ok) setD(r.data!);
    else setMsg(r.error);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function sell() {
    const p = parseInt(price, 10);
    if (isNaN(p) || !soldAt) {
      setMsg("売値と売却日は必須");
      return;
    }
    setMsg("登録中...");
    const r = await apiFetch<{ gross_profit: number }>("/api/sales", {
      method: "POST",
      body: JSON.stringify({ product_id: id, sale_price: p, channel, sold_at: soldAt }),
    });
    if (r.ok) {
      setMsg(`販売登録（粗利 ${formatYen(r.data!.gross_profit)}）`);
      load();
    } else setMsg(r.error);
  }
  if (!d) return <main className="p-4">{msg ?? "読み込み中..."}</main>;
  const previewGross = price ? grossProfit(parseInt(price, 10) || 0, d.product.cost) : null;

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-lg font-bold">{d.product.name}</h1>
      <p className="text-sm">
        原価 {formatYen(d.product.cost)}・状態 {d.product.status}
      </p>

      {d.sale ? (
        <div className="bg-green-50 rounded p-3 text-sm">
          売却済：売値 {formatYen(d.sale.sale_price)}／粗利{" "}
          <b>{formatYen(d.sale.gross_profit)}</b>（{d.sale.channel}・{d.sale.sold_at}）
        </div>
      ) : (
        <section className="space-y-2">
          <h2 className="font-bold text-sm">販売登録</h2>
          <input
            className="border p-2 w-full"
            type="number"
            inputMode="numeric"
            placeholder="売値（円）"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          {previewGross !== null && <p className="text-sm">想定粗利: {formatYen(previewGross)}</p>}
          <select
            className="border p-2 w-full"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            className="border p-2 w-full"
            type="date"
            value={soldAt}
            onChange={(e) => setSoldAt(e.target.value)}
          />
          {msg && <p className="text-red-600">{msg}</p>}
          <button onClick={sell} className="bg-black text-white w-full py-3 rounded">
            販売を登録
          </button>
        </section>
      )}
    </main>
  );
}

"use client";
import { useEffect, useState, use } from "react";
import { apiFetch } from "@/lib/liffClient";
import { formatYen, sumAmounts, sumCosts } from "@/lib/money";
import { label, PRODUCT_STATUS_LABELS } from "@/lib/labels";

type PItem = { id: string; name: string; amount: number };
type Detail = { purchase_items: PItem[] };
type Prod = { id: string; name: string; cost: number; status: string };

export default function ProductizePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [items, setItems] = useState<PItem[]>([]);
  const [products, setProducts] = useState<Prod[]>([]);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [msg, setMsg] = useState<string>();

  async function load() {
    const d = await apiFetch<Detail>(`/api/cases/${id}`);
    if (d.ok) setItems(d.data!.purchase_items);
    const p = await apiFetch<Prod[]>(`/api/products?case_id=${id}`);
    if (p.ok) setProducts(p.data!);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const pool = sumAmounts(items);
  const allocated = sumCosts(products);
  const remaining = pool - allocated;

  function toggle(pid: string) {
    setSel((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]));
  }
  async function create() {
    const c = parseInt(cost, 10);
    if (!name || isNaN(c)) {
      setMsg("商品名と原価は必須");
      return;
    }
    if (sel.length === 0) {
      setMsg("源泉の買取明細を選んでください");
      return;
    }
    const r = await apiFetch<{ id: string }>("/api/products", {
      method: "POST",
      body: JSON.stringify({ case_id: id, name, cost: c, source_purchase_item_ids: sel }),
    });
    if (r.ok) {
      setName("");
      setCost("");
      setSel([]);
      setMsg(undefined);
      load();
    } else setMsg(r.error);
  }

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-lg font-bold">商品化</h1>
      <div className="bg-gray-100 rounded p-3 text-sm">
        仕入プール: <b>{formatYen(pool)}</b> ／ 割当済: <b>{formatYen(allocated)}</b> ／ 残:{" "}
        <b className={remaining < 0 ? "text-red-600" : ""}>{formatYen(remaining)}</b>
        {remaining < 0 && <span className="text-red-600">（原価が仕入を超過）</span>}
      </div>

      <section>
        <h2 className="font-bold text-sm">源泉の買取明細（チェックで選択）</h2>
        {items.map((it) => (
          <label key={it.id} className="flex items-center gap-2 py-1 border-b">
            <input type="checkbox" checked={sel.includes(it.id)} onChange={() => toggle(it.id)} />
            <span className="flex-1">{it.name}</span>
            <span>{formatYen(it.amount)}</span>
          </label>
        ))}
        {items.length === 0 && <p className="text-gray-400 py-2">買取明細がありません</p>}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold text-sm">新しい商品</h2>
        <input
          className="border p-2 w-full"
          placeholder="商品名（出品名）"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="border p-2 w-full"
          type="number"
          inputMode="numeric"
          placeholder="原価（円）"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
        {msg && <p className="text-red-600">{msg}</p>}
        <button onClick={create} className="bg-black text-white w-full py-2 rounded">
          この商品を作る
        </button>
      </section>

      <section>
        <h2 className="font-bold text-sm">作成済みの商品</h2>
        {products.map((p) => (
          <div key={p.id} className="flex justify-between py-1 border-b">
            <span>
              {p.name}（{label(PRODUCT_STATUS_LABELS, p.status)}）
            </span>
            <span>原価 {formatYen(p.cost)}</span>
          </div>
        ))}
        {products.length === 0 && <p className="text-gray-400 py-2">まだありません</p>}
      </section>
    </main>
  );
}

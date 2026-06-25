"use client";
import { useEffect, useState, use } from "react";
import { apiFetch } from "@/lib/liffClient";
import { formatYen, sumAmounts, sumCosts } from "@/lib/money";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Field, inputClass } from "@/components/ui/field";

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
  const [saving, setSaving] = useState(false);

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
    setMsg(undefined);
    setSaving(true);
    try {
      const r = await apiFetch<{ id: string }>("/api/products", {
        method: "POST",
        body: JSON.stringify({ case_id: id, name, cost: c, source_purchase_item_ids: sel }),
      });
      if (r.ok) {
        setName("");
        setCost("");
        setSel([]);
        load();
      } else setMsg(r.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <AppHeader title="商品化" backHref={`/cases/${id}`} />
      <section className="px-5 pt-6 space-y-4">
        <Card className="bg-bg">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">仕入プール</span>
              <b>{formatYen(pool)}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">割当済</span>
              <b>{formatYen(allocated)}</b>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">残</span>
              <b className={remaining < 0 ? "text-danger" : ""}>
                {formatYen(remaining)}
              </b>
            </div>
            {remaining < 0 && (
              <p className="text-danger text-xs pt-1">（原価が仕入を超過）</p>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold mb-2">
            源泉の買取明細（チェックで選択）
          </h2>
          {items.map((it) => (
            <label
              key={it.id}
              className="flex items-center gap-2 py-2 border-b border-border text-sm"
            >
              <input
                type="checkbox"
                checked={sel.includes(it.id)}
                onChange={() => toggle(it.id)}
                className="w-4 h-4 accent-primary"
              />
              <span className="flex-1">{it.name}</span>
              <span>{formatYen(it.amount)}</span>
            </label>
          ))}
          {items.length === 0 && (
            <p className="text-subtle text-sm py-2">買取明細がありません</p>
          )}
        </Card>

        <Card>
          <h2 className="text-base font-semibold mb-3">新しい商品</h2>
          <div className="space-y-3">
            <Field label="商品名（出品名）" required>
              <input
                className={inputClass}
                placeholder="商品名（出品名）"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="原価（円）" required>
              <input
                className={inputClass}
                type="number"
                inputMode="numeric"
                placeholder="原価（円）"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </Field>
            {msg && <p className="text-danger text-sm">{msg}</p>}
            <Button onClick={create} loading={saving} loadingText="作成中...">
              この商品を作る
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold mb-2">作成済みの商品</h2>
          {products.map((p) => (
            <div
              key={p.id}
              className="flex justify-between items-center py-2 border-b border-border text-sm"
            >
              <span className="flex items-center gap-2">
                {p.name}
                <StatusBadge status={p.status} kind="product" />
              </span>
              <span>原価 {formatYen(p.cost)}</span>
            </div>
          ))}
          {products.length === 0 && (
            <p className="text-subtle text-sm py-2">まだありません</p>
          )}
        </Card>
      </section>
    </main>
  );
}

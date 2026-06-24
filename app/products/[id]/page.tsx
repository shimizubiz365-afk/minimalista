"use client";
import { useEffect, useState, use } from "react";
import { Check } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { formatYen, grossProfit } from "@/lib/money";
import { label, CHANNEL_LABELS } from "@/lib/labels";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Field, inputClass } from "@/components/ui/field";

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
  if (!d)
    return (
      <main>
        <AppHeader title="商品詳細" backHref="/products" />
        <p className="px-5 pt-10 text-center text-subtle text-sm">
          {msg ?? "読み込み中..."}
        </p>
      </main>
    );
  const previewGross = price ? grossProfit(parseInt(price, 10) || 0, d.product.cost) : null;

  return (
    <main>
      <AppHeader title="商品詳細" backHref="/products" />
      <section className="px-5 pt-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold mb-1">{d.product.name}</h1>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span>原価 {formatYen(d.product.cost)}</span>
            <StatusBadge status={d.product.status} kind="product" />
          </div>
        </div>

        {d.sale ? (
          <Card className="bg-success/10 border-success/30">
            <p className="text-sm flex items-center gap-1.5 mb-1 text-success font-medium">
              <Check className="w-4 h-4" /> 売却済
            </p>
            <p className="text-sm">
              売値 {formatYen(d.sale.sale_price)}／粗利{" "}
              <b>{formatYen(d.sale.gross_profit)}</b>（
              {label(CHANNEL_LABELS, d.sale.channel)}・{d.sale.sold_at}）
            </p>
          </Card>
        ) : (
          <Card>
            <h2 className="text-base font-semibold mb-3">販売登録</h2>
            <div className="space-y-3">
              <Field label="売値（円）" required>
                <input
                  className={inputClass}
                  type="number"
                  inputMode="numeric"
                  placeholder="売値（円）"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </Field>
              {previewGross !== null && (
                <p className="text-sm text-muted">
                  想定粗利: <b className="text-fg">{formatYen(previewGross)}</b>
                </p>
              )}
              <Field label="販売チャネル">
                <select
                  className={inputClass}
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {label(CHANNEL_LABELS, c)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="売却日" required>
                <input
                  className={inputClass}
                  type="date"
                  value={soldAt}
                  onChange={(e) => setSoldAt(e.target.value)}
                />
              </Field>
              {msg && <p className="text-danger text-sm">{msg}</p>}
              <Button onClick={sell} size="lg">
                販売を登録
              </Button>
            </div>
          </Card>
        )}
      </section>
    </main>
  );
}

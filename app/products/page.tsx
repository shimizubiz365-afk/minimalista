"use client";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { formatYen } from "@/lib/money";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/cn";

type Prod = {
  id: string;
  name: string;
  cost: number;
  status: string;
  acquired_customer: { name: string } | null;
};
const TABS = [
  ["in_stock", "在庫"],
  ["listed", "出品中"],
  ["sold", "売却済"],
] as const;

export default function ProductsPage() {
  const [tab, setTab] = useState("in_stock");
  const [rows, setRows] = useState<Prod[]>([]);
  useEffect(() => {
    apiFetch<Prod[]>(`/api/products?status=${tab}`).then((r) => r.ok && setRows(r.data ?? []));
  }, [tab]);
  return (
    <main>
      <AppHeader title="在庫一覧" showLogo={false} />
      <div className="px-5 pt-4 flex gap-2">
        {TABS.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              tab === v
                ? "bg-primary text-white"
                : "bg-surface border border-border text-muted"
            )}
          >
            {l}
          </button>
        ))}
      </div>
      <section className="px-5 pt-4 space-y-3">
        {rows.map((p) => (
          <Card key={p.id} href={`/products/${p.id}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="mb-1.5">
                  <StatusBadge status={p.status} kind="product" />
                </div>
                <h3 className="text-base font-semibold mb-0.5 truncate">{p.name}</h3>
                {p.acquired_customer?.name && (
                  <p className="text-xs text-muted">
                    {p.acquired_customer.name} 様
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-sm text-muted">原価 {formatYen(p.cost)}</span>
                <ChevronRight className="w-5 h-5 text-subtle" />
              </div>
            </div>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="py-10 text-center text-subtle text-sm">該当なし</p>
        )}
      </section>
    </main>
  );
}

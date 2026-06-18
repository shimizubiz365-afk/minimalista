"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/liffClient";
import { formatYen } from "@/lib/money";

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
    <main className="p-4 space-y-4">
      <h1 className="text-lg font-bold">在庫</h1>
      <div className="flex gap-2">
        {TABS.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-3 py-1 rounded ${tab === v ? "bg-black text-white" : "bg-gray-200"}`}
          >
            {l}
          </button>
        ))}
      </div>
      <ul className="divide-y">
        {rows.map((p) => (
          <li key={p.id}>
            <Link href={`/products/${p.id}`} className="flex justify-between py-3">
              <span>
                {p.name}
                <br />
                <span className="text-xs text-gray-500">{p.acquired_customer?.name}</span>
              </span>
              <span>原価 {formatYen(p.cost)}</span>
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="py-6 text-gray-400">該当なし</li>}
      </ul>
    </main>
  );
}

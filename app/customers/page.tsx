"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { inputClass } from "@/components/ui/field";

type Cust = {
  id: string;
  customer_no: string;
  name: string;
  name_kana: string | null;
  phone: string | null;
  address: string | null;
};

export default function CustomersSearch() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Cust[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    const term = q.trim();
    if (!term) return;
    setLoading(true);
    const r = await apiFetch<Cust[]>(`/api/customers/search?q=${encodeURIComponent(term)}`);
    setLoading(false);
    setSearched(true);
    if (r.ok) setRows(r.data ?? []);
  }

  return (
    <main className="pb-10">
      <AppHeader title="顧客検索" backHref="/" />

      <section className="px-5 pt-5">
        <form onSubmit={search} className="flex gap-2">
          <input
            className={inputClass}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="氏名・カナ・電話番号で検索"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !q.trim()}
            className="shrink-0 h-12 px-4 rounded-md bg-primary text-white font-medium flex items-center gap-1 active:bg-primary/90 disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            {loading ? "…" : "検索"}
          </button>
        </form>
        <p className="text-xs text-subtle mt-2">再訪問はここで顧客を探して登録できます</p>
      </section>

      <section className="px-5 pt-5">
        {searched && rows.length === 0 && !loading && (
          <p className="text-sm text-subtle py-6 text-center">該当する顧客が見つかりません</p>
        )}
        {rows.map((c) => (
          <Card key={c.id} className="mb-2">
            <Link href={`/customers/${c.id}`} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{c.name} 様</span>
                  <span className="text-[10px] text-muted">{c.customer_no}</span>
                </div>
                <p className="text-xs text-muted truncate">
                  {[c.phone, c.address].filter(Boolean).join("・") || "—"}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-subtle shrink-0" />
            </Link>
          </Card>
        ))}
      </section>
    </main>
  );
}

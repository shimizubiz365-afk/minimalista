"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Phone, CalendarPlus, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";

type Detail = {
  customer: {
    id: string;
    customer_no: string;
    name: string;
    name_kana: string | null;
    phone: string | null;
    address: string | null;
  };
  cases: {
    id: string;
    status: string;
    visit_at: string | null;
    desired_items: string | null;
    created_at: string;
  }[];
};

export default function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [d, setD] = useState<Detail>();
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string>();

  useEffect(() => {
    apiFetch<Detail>(`/api/customers/${id}`).then((r) => {
      if (r.ok) setD(r.data);
      else setMsg(r.error);
    });
  }, [id]);

  async function revisit() {
    setCreating(true);
    setMsg(undefined);
    const r = await apiFetch<{ id: string }>("/api/cases", {
      method: "POST",
      body: JSON.stringify({
        customer: { existing_id: id },
        source: "phone",
      }),
    });
    setCreating(false);
    if (r.ok && r.data) router.push(`/cases/${r.data.id}/confirm`);
    else setMsg(r.error ?? "登録に失敗しました");
  }

  return (
    <main className="pb-6">
      <AppHeader title="顧客" backHref="/customers" />
      {msg && <p className="px-5 pt-4 text-sm text-danger">{msg}</p>}
      {!d && <p className="px-5 pt-6 text-sm text-muted">読み込み中…</p>}

      {d && (
        <>
          <section className="px-5 pt-5">
            <Card>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-semibold">{d.customer.name} 様</h1>
                <span className="text-[10px] text-muted">{d.customer.customer_no}</span>
              </div>
              {d.customer.name_kana && (
                <p className="text-xs text-muted mb-2">{d.customer.name_kana}</p>
              )}
              {d.customer.address && (
                <p className="text-sm text-muted mb-1">{d.customer.address}</p>
              )}
              {d.customer.phone && (
                <a
                  href={`tel:${d.customer.phone}`}
                  className="mt-2 w-full h-11 text-white rounded-md font-medium flex items-center justify-center gap-2 bg-warning active:bg-warning/90"
                >
                  <Phone className="w-4 h-4" /> {d.customer.phone} に電話
                </a>
              )}
            </Card>
          </section>

          <section className="px-5 pt-5">
            <h2 className="text-sm font-semibold mb-3">
              これまでの案件 <span className="text-muted">{d.cases.length}件</span>
            </h2>
            {d.cases.length === 0 && (
              <p className="text-sm text-subtle py-3 text-center">まだ案件はありません</p>
            )}
            {d.cases.map((c) => (
              <Card key={c.id} href={`/cases/${c.id}`} className="mb-2">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <StatusBadge status={c.status} />
                      <span className="text-xs text-muted">
                        {c.visit_at ? c.visit_at.slice(0, 10).replace(/-/g, "/") : "日程未定"}
                      </span>
                    </div>
                    {c.desired_items && (
                      <p className="text-xs text-muted truncate">{c.desired_items}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-subtle shrink-0" />
                </div>
              </Card>
            ))}
          </section>

          {/* 再訪問登録（インライン配置＝下部UIに隠れない） */}
          <div className="px-5 pt-5 pb-10">
            <Button onClick={revisit} loading={creating} loadingText="作成中…" size="lg">
              <CalendarPlus className="w-5 h-5" /> この顧客で再訪問を登録
            </Button>
          </div>
        </>
      )}
    </main>
  );
}

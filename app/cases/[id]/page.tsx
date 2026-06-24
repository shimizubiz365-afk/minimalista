"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Plus, ChevronRight, Check, FileText, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { formatYen } from "@/lib/money";
import { label, CASE_STATUS_LABELS } from "@/lib/labels";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

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
  if (!d)
    return (
      <main>
        <AppHeader title="案件詳細" backHref="/cases" />
        <p className="px-5 pt-10 text-center text-subtle text-sm">
          {msg ?? "読み込み中..."}
        </p>
      </main>
    );

  const buyTotal = d.purchase_items.reduce((a, i) => a + i.amount, 0);
  const workTotal = d.collection_items.reduce((a, i) => a + i.work_fee, 0);

  return (
    <main>
      <AppHeader title="案件詳細" backHref="/cases" />
      <section className="px-5 pt-6 space-y-4">
        <div>
          <p className="text-xs text-muted mb-0.5">{d.customer.customer_no}</p>
          <h1 className="text-xl font-semibold">{d.customer.name} 様</h1>
          <p className="text-sm text-muted mt-1">
            {d.customer.phone}・{d.customer.address}
          </p>
          <p className="text-sm text-muted">
            訪問: {d.case.visit_at ?? "未定"}・{d.case.area}
          </p>
        </div>

        <Field label="ステータス">
          <select
            className={inputClass}
            value={d.case.status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUSES.map((st) => (
              <option key={st} value={st}>
                {label(CASE_STATUS_LABELS, st)}
              </option>
            ))}
          </select>
        </Field>

        {/* 本人確認 */}
        <Card>
          <h2 className="text-base font-semibold mb-2">本人確認</h2>
          {d.case.verification_method ? (
            <p className="text-sm text-success flex items-center gap-1.5">
              <Check className="w-4 h-4" /> 確認済み（{d.case.verification_method}）
            </p>
          ) : (
            <Link
              href={`/cases/${id}/verify`}
              className="text-info text-sm flex items-center gap-1"
            >
              本人確認を実施 <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </Card>

        {/* 買取明細 */}
        <Card>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-base font-semibold">買取明細</h2>
            <Link
              href={`/cases/${id}/purchase`}
              className="text-info text-sm flex items-center gap-0.5"
            >
              <Plus className="w-4 h-4" /> 入力
            </Link>
          </div>
          {d.purchase_items.map((i) => (
            <div
              key={i.id}
              className="flex justify-between py-2 border-b border-border text-sm"
            >
              <span>{i.name}</span>
              <span>{formatYen(i.amount)}</span>
            </div>
          ))}
          <div className="text-right font-semibold mt-2 mb-3">
            買取合計 {formatYen(buyTotal)}
          </div>
          <Button
            variant="secondary"
            onClick={() => issue("purchase-slip")}
            disabled={d.purchase_items.length === 0}
          >
            <FileText className="w-4 h-4" /> 買取伝票PDF発行
          </Button>
        </Card>

        {/* 回収明細 */}
        <Card>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-base font-semibold">回収明細</h2>
            <Link
              href={`/cases/${id}/collection`}
              className="text-info text-sm flex items-center gap-0.5"
            >
              <Plus className="w-4 h-4" /> 入力
            </Link>
          </div>
          {d.collection_items.map((i) => (
            <div
              key={i.id}
              className="flex justify-between py-2 border-b border-border text-sm"
            >
              <span>{i.item_name}</span>
              <span>{formatYen(i.work_fee)}</span>
            </div>
          ))}
          <div className="text-right font-semibold mt-2 mb-3">
            作業費合計 {formatYen(workTotal)}
          </div>
          <Button
            variant="secondary"
            onClick={() => issue("receipt")}
            disabled={d.collection_items.length === 0}
          >
            <FileText className="w-4 h-4" /> 領収書PDF発行
          </Button>
        </Card>

        {/* 在庫化 */}
        <Card href={`/cases/${id}/products`}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">この案件を商品化する</h2>
            <ChevronRight className="w-5 h-5 text-subtle" />
          </div>
        </Card>

        {/* 精算 */}
        <Card>
          <h2 className="text-base font-semibold mb-2">精算</h2>
          {d.case.status === "closed" ? (
            <p className="text-sm text-success flex items-center gap-1.5">
              <Check className="w-4 h-4" /> 精算確定済み（クローズ）
            </p>
          ) : (
            <>
              <Field label="受領/支払 現金（円）">
                <input
                  className={inputClass}
                  type="number"
                  inputMode="numeric"
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  placeholder={`差引: ${formatYen(buyTotal - workTotal)}`}
                />
              </Field>
              <Button variant="danger" onClick={settle} className="mt-3">
                精算を確定する（台帳生成・クローズ）
              </Button>
            </>
          )}
        </Card>

        {msg && <p className="text-danger text-sm">{msg}</p>}
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full h-12 rounded-md bg-success text-white font-medium flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" /> 発行したPDFを開く
          </a>
        )}
      </section>
    </main>
  );
}

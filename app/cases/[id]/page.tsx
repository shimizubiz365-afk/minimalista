"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  Plus,
  ChevronRight,
  Check,
  FileText,
  ExternalLink,
  CalendarCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { formatYen } from "@/lib/money";
import { label, CASE_STATUS_LABELS } from "@/lib/labels";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputClass, textareaClass } from "@/components/ui/field";

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
const STATUSES = ["reserved", "visiting", "pending_pickup", "closed", "cancelled"];

export default function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Detail>();
  const [msg, setMsg] = useState<string>();
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({});
  const [cash, setCash] = useState("");
  const [visitAt, setVisitAt] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<{
    kind: "p" | "c";
    id: string;
    a: string;
    b: string;
  } | null>(null);
  const editCls =
    "border border-border rounded-md px-2 h-9 bg-surface text-fg focus:outline-none focus:border-primary";

  async function load() {
    const r = await apiFetch<Detail>(`/api/cases/${id}`);
    if (r.ok) {
      setD(r.data!);
      setVisitAt(r.data!.case.visit_at ? r.data!.case.visit_at.slice(0, 16) : "");
      setMemo(r.data!.case.memo ?? "");
    } else setMsg(r.error);
  }

  async function saveSchedule() {
    setSaving(true);
    setMsg(undefined);
    const r = await apiFetch(`/api/cases/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ visit_at: visitAt || null, memo }),
    });
    setSaving(false);
    if (r.ok) {
      setMsg("予約を確定しました");
      load();
    } else setMsg(r.error);
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
  async function issue(kind: "purchase-slip" | "receipt" | "work-order" | "estimate") {
    setMsg("発行中...");
    const r = await apiFetch<{ signed_url: string }>(`/api/documents/${kind}`, {
      method: "POST",
      body: JSON.stringify({ case_id: id }),
    });
    if (r.ok) {
      setPdfUrls((u) => ({ ...u, [kind]: r.data!.signed_url }));
      setMsg(undefined);
    } else setMsg(r.error);
  }
  async function saveItem() {
    if (!edit) return;
    const path =
      edit.kind === "p"
        ? `/api/purchase-items/${edit.id}`
        : `/api/collection-items/${edit.id}`;
    const fee = parseInt(edit.b, 10);
    if (isNaN(fee)) {
      setMsg("金額を数値で入力してください");
      return;
    }
    const body =
      edit.kind === "p"
        ? { name: edit.a, amount: fee }
        : { item_name: edit.a, work_fee: fee };
    const r = await apiFetch(path, { method: "PATCH", body: JSON.stringify(body) });
    if (r.ok) {
      setEdit(null);
      load();
    } else setMsg(r.error);
  }
  async function delItem(kind: "p" | "c", id: string) {
    if (!confirm("この明細を削除しますか？")) return;
    const path =
      kind === "p" ? `/api/purchase-items/${id}` : `/api/collection-items/${id}`;
    const r = await apiFetch(path, { method: "DELETE" });
    if (r.ok) load();
    else setMsg(r.error);
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
  const editable = d.case.status !== "closed";

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

        {/* 予約・訪問日程（電話後にここで確定） */}
        <Card>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-1.5">
            <CalendarCheck className="w-4 h-4 text-primary" /> 予約・訪問日程
          </h2>
          <Field label="訪問日時">
            <input
              className={inputClass}
              type="datetime-local"
              value={visitAt}
              onChange={(e) => setVisitAt(e.target.value)}
            />
          </Field>
          <Field label="備考（通話メモ）" className="mt-3">
            <textarea
              className={textareaClass}
              rows={3}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="例: 6/27 14時で確定。マンション3F、エレベーター無し"
            />
          </Field>
          <Button onClick={saveSchedule} disabled={saving} className="mt-3">
            <CalendarCheck className="w-4 h-4" /> {visitAt ? "予約を確定する" : "保存する"}
          </Button>
        </Card>

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
            <div key={i.id} className="py-2 border-b border-border text-sm">
              {edit?.kind === "p" && edit.id === i.id ? (
                <div className="flex gap-1.5 items-center">
                  <input
                    className={`${editCls} flex-1 min-w-0`}
                    value={edit.a}
                    onChange={(e) => setEdit({ ...edit, a: e.target.value })}
                  />
                  <input
                    className={`${editCls} w-24`}
                    type="number"
                    inputMode="numeric"
                    value={edit.b}
                    onChange={(e) => setEdit({ ...edit, b: e.target.value })}
                  />
                  <button
                    onClick={saveItem}
                    className="shrink-0 bg-primary text-white rounded-md px-3 h-9 text-sm font-medium"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEdit(null)}
                    className="shrink-0 text-muted rounded-md px-2 h-9 text-sm"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="min-w-0 truncate">{i.name}</span>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span>{formatYen(i.amount)}</span>
                    {editable && (
                      <>
                        <button
                          onClick={() => setEdit({ kind: "p", id: i.id, a: i.name, b: String(i.amount) })}
                          className="text-info text-sm font-medium border border-info/40 rounded px-2 py-0.5"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => delItem("p", i.id)}
                          className="text-danger text-sm font-medium border border-danger/40 rounded px-2 py-0.5"
                        >
                          削除
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="text-right font-semibold mt-2 mb-3">
            買取合計 {formatYen(buyTotal)}
          </div>
          <div className="space-y-2">
            <Button
              variant="secondary"
              onClick={() => issue("purchase-slip")}
              disabled={d.purchase_items.length === 0}
            >
              <FileText className="w-4 h-4" /> 買取伝票PDF発行
            </Button>
            {pdfUrls["purchase-slip"] && (
              <PdfOpen url={pdfUrls["purchase-slip"]} label="買取伝票を開く" />
            )}
          </div>
        </Card>

        {/* 作業依頼書（旧:回収明細） */}
        <Card>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-base font-semibold">作業依頼書</h2>
            <Link
              href={`/cases/${id}/collection`}
              className="text-info text-sm flex items-center gap-0.5"
            >
              <Plus className="w-4 h-4" /> 入力
            </Link>
          </div>
          {d.collection_items.map((i) => (
            <div key={i.id} className="py-2 border-b border-border text-sm">
              {edit?.kind === "c" && edit.id === i.id ? (
                <div className="flex gap-1.5 items-center">
                  <input
                    className={`${editCls} flex-1 min-w-0`}
                    value={edit.a}
                    onChange={(e) => setEdit({ ...edit, a: e.target.value })}
                  />
                  <input
                    className={`${editCls} w-24`}
                    type="number"
                    inputMode="numeric"
                    value={edit.b}
                    onChange={(e) => setEdit({ ...edit, b: e.target.value })}
                  />
                  <button
                    onClick={saveItem}
                    className="shrink-0 bg-primary text-white rounded-md px-3 h-9 text-sm font-medium"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEdit(null)}
                    className="shrink-0 text-muted rounded-md px-2 h-9 text-sm"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="min-w-0 truncate">{i.item_name}</span>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span>{formatYen(i.work_fee)}</span>
                    {editable && (
                      <>
                        <button
                          onClick={() => setEdit({ kind: "c", id: i.id, a: i.item_name, b: String(i.work_fee) })}
                          className="text-info text-sm font-medium border border-info/40 rounded px-2 py-0.5"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => delItem("c", i.id)}
                          className="text-danger text-sm font-medium border border-danger/40 rounded px-2 py-0.5"
                        >
                          削除
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="text-right font-semibold mt-2 mb-3">
            作業費合計 {formatYen(workTotal)}
          </div>
          <div className="space-y-2">
            <Button
              onClick={() => issue("work-order")}
              disabled={d.collection_items.length === 0}
            >
              <FileText className="w-4 h-4" /> 作業依頼書PDF発行
            </Button>
            {pdfUrls["work-order"] && (
              <PdfOpen url={pdfUrls["work-order"]} label="作業依頼書を開く" />
            )}
            <Button
              variant="secondary"
              onClick={() => issue("receipt")}
              disabled={d.collection_items.length === 0}
            >
              <FileText className="w-4 h-4" /> 領収書PDF発行
            </Button>
            {pdfUrls["receipt"] && (
              <PdfOpen url={pdfUrls["receipt"]} label="領収書を開く" />
            )}
          </div>
        </Card>

        {/* お見積書（買取査定額−回収作業費の差引・取引前の提示用） */}
        <Card>
          <h2 className="text-base font-semibold mb-1">お見積書</h2>
          <p className="text-xs text-muted mb-3">
            買取査定額と回収作業費をまとめ、差引の金額を1枚で提示します（取引前のお客様提示用）。
          </p>
          <div className="space-y-2">
            <Button
              onClick={() => issue("estimate")}
              disabled={
                d.purchase_items.length === 0 && d.collection_items.length === 0
              }
            >
              <FileText className="w-4 h-4" /> お見積書PDF発行
            </Button>
            {pdfUrls["estimate"] && (
              <PdfOpen url={pdfUrls["estimate"]} label="お見積書を開く" />
            )}
          </div>
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
      </section>
    </main>
  );
}

function PdfOpen({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="w-full h-12 rounded-md bg-success text-white font-medium flex items-center justify-center gap-2"
    >
      <ExternalLink className="w-4 h-4" /> {label}
    </a>
  );
}

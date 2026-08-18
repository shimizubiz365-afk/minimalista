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
import { formatYen, netAmount, taxBreakdown, type TaxMode } from "@/lib/money";
import { label, CASE_STATUS_LABELS, CASE_STATUS_FLOW } from "@/lib/labels";
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

export default function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Detail>();
  const [msg, setMsg] = useState<string>();
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({});
  const [taxMode, setTaxMode] = useState<TaxMode>("exclusive");
  const [issuing, setIssuing] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [dueDate, setDueDate] = useState(
    () => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
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
  async function issue(
    kind: "purchase-slip" | "receipt" | "work-order" | "estimate" | "invoice",
    extra?: Record<string, unknown>
  ) {
    setIssuing(kind);
    setMsg(undefined);
    const r = await apiFetch<{ signed_url: string }>(`/api/documents/${kind}`, {
      method: "POST",
      body: JSON.stringify({ case_id: id, ...extra }),
    });
    setIssuing(null);
    if (r.ok) {
      setPdfUrls((u) => ({ ...u, [kind]: r.data!.signed_url }));
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
  // 精算額は「買取合計 − 作業費合計」で確定する（自由入力はしない）。
  async function settle() {
    setSettling(true);
    setMsg(undefined);
    const r = await apiFetch<{ net_amount: number }>("/api/settlements", {
      method: "POST",
      body: JSON.stringify({ case_id: id }),
    });
    setSettling(false);
    if (r.ok) {
      setMsg("精算を確定しました");
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
  const workTax = taxBreakdown(workTotal, taxMode);
  const net = netAmount(buyTotal, workTotal);
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

        {/* 日程・住所・担当の編集（必要時のみ→確定画面へ。確定済みなので常設フォームは不要） */}
        <Link
          href={`/cases/${id}/confirm`}
          className="h-11 rounded-md border border-border text-sm font-medium flex items-center justify-center gap-1.5 active:bg-border/40"
        >
          <CalendarCheck className="w-4 h-4 text-primary" /> 日程・住所・担当を編集
        </Link>

        <Field label="ステータス">
          <select
            className={inputClass}
            value={d.case.status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {CASE_STATUS_FLOW.map((st) => (
              <option key={st} value={st}>
                {label(CASE_STATUS_LABELS, st)}
              </option>
            ))}
          </select>
        </Field>

        {/* 本人確認（買取時の身分証記録。台帳の自動記帳は現在オフ） */}
        <Card>
          <h2 className="text-base font-semibold mb-2">本人確認</h2>
          {d.purchase_items.length === 0 ? (
            <p className="text-sm text-muted">
              回収のみの案件のため本人確認は不要です。
            </p>
          ) : d.case.verification_method ? (
            <p className="text-sm text-success flex items-center gap-1.5">
              <Check className="w-4 h-4" /> 確認済み（{d.case.verification_method}）
            </p>
          ) : (
            <div className="space-y-1.5">
              <Link
                href={`/cases/${id}/verify`}
                className="text-info text-sm flex items-center gap-1"
              >
                本人確認を実施 <ChevronRight className="w-4 h-4" />
              </Link>
              <p className="text-xs text-muted">
                買取がある案件です。身分証を記録しておくと後から台帳を作れます（未了でも精算はできます）。
              </p>
            </div>
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
              loading={issuing === "purchase-slip"}
              loadingText="発行中..."
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
                    className={`${editCls} w-20`}
                    type="number"
                    inputMode="numeric"
                    value={edit.b}
                    onChange={(e) => setEdit({ ...edit, b: e.target.value })}
                  />
                  {/* 値引き・サービス用の符号反転（スマホの数字キーに「−」が無いため） */}
                  <button
                    onClick={() => setEdit({ ...edit, b: String(-(parseInt(edit.b, 10) || 0)) })}
                    className="shrink-0 border border-border rounded-md w-9 h-9 text-sm font-medium"
                    title="プラス/マイナスを切り替え"
                  >
                    ±
                  </button>
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
          {/* 税区分（外税/内税）— 作業依頼書・領収書に反映 */}
          <div className="mt-3 mb-2">
            <p className="text-xs text-muted mb-1">税区分（作業依頼書・領収書に反映）</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTaxMode("exclusive")}
                className={`flex-1 h-9 rounded-md text-sm font-medium border ${
                  taxMode === "exclusive"
                    ? "bg-primary text-white border-primary"
                    : "bg-surface text-fg border-border"
                }`}
              >
                外税（税抜＋消費税）
              </button>
              <button
                type="button"
                onClick={() => setTaxMode("inclusive")}
                className={`flex-1 h-9 rounded-md text-sm font-medium border ${
                  taxMode === "inclusive"
                    ? "bg-primary text-white border-primary"
                    : "bg-surface text-fg border-border"
                }`}
              >
                内税（税込）
              </button>
            </div>
          </div>
          <div className="text-right text-sm mt-2 mb-3">
            {taxMode === "exclusive" ? (
              <>
                <div className="text-muted">作業費小計（税抜） {formatYen(workTax.subtotal)}</div>
                <div className="text-muted">消費税（10%） {formatYen(workTax.tax)}</div>
                <div className="font-semibold">税込合計 {formatYen(workTax.total)}</div>
              </>
            ) : (
              <>
                <div className="font-semibold">作業費合計（税込） {formatYen(workTax.total)}</div>
                <div className="text-muted">うち消費税（10%） {formatYen(workTax.tax)}</div>
              </>
            )}
          </div>
          <div className="space-y-2">
            <Button
              onClick={() => issue("work-order", { tax_mode: taxMode })}
              loading={issuing === "work-order"}
              loadingText="発行中..."
              disabled={d.collection_items.length === 0}
            >
              <FileText className="w-4 h-4" /> 作業依頼書PDF発行
            </Button>
            {pdfUrls["work-order"] && (
              <PdfOpen url={pdfUrls["work-order"]} label="作業依頼書を開く" />
            )}
            <Button
              variant="secondary"
              onClick={() => issue("receipt", { tax_mode: taxMode })}
              loading={issuing === "receipt"}
              loadingText="発行中..."
              disabled={d.collection_items.length === 0}
            >
              <FileText className="w-4 h-4" /> 領収書PDF発行
            </Button>
            {pdfUrls["receipt"] && (
              <PdfOpen url={pdfUrls["receipt"]} label="領収書を開く" />
            )}
            <div className="pt-1">
              <label className="text-xs text-muted block mb-1">請求書の支払期限</label>
              <input
                type="date"
                className={inputClass}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => issue("invoice", { tax_mode: taxMode, due_date: dueDate })}
              loading={issuing === "invoice"}
              loadingText="発行中..."
              disabled={d.collection_items.length === 0}
            >
              <FileText className="w-4 h-4" /> 請求書PDF発行
            </Button>
            {pdfUrls["invoice"] && (
              <PdfOpen url={pdfUrls["invoice"]} label="請求書を開く" />
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
              loading={issuing === "estimate"}
              loadingText="発行中..."
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

        {/* 精算 */}
        <Card>
          <h2 className="text-base font-semibold mb-2">精算</h2>
          {d.case.status === "closed" ? (
            <p className="text-sm text-success flex items-center gap-1.5">
              <Check className="w-4 h-4" /> 精算確定済み（クローズ）
            </p>
          ) : (
            <>
              <div className="text-sm space-y-1 mb-3">
                <div className="flex justify-between">
                  <span className="text-muted">買取合計</span>
                  <span>{formatYen(buyTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">作業費合計</span>
                  <span>{formatYen(-workTotal)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border font-semibold text-base">
                  <span>差引</span>
                  <span>{formatYen(Math.abs(net))}</span>
                </div>
                <p className="text-xs text-muted pt-1">
                  {net > 0
                    ? "お客様へお支払いする金額です。"
                    : net < 0
                      ? "お客様から受領する金額です。"
                      : "受け渡しの現金はありません。"}
                </p>
              </div>
              <Button
                variant="danger"
                onClick={settle}
                loading={settling}
                loadingText="精算中..."
              >
                この金額で精算を確定する（案件をクローズ）
              </Button>
            </>
          )}
        </Card>

        {msg && <p className="text-danger text-sm whitespace-pre-line">{msg}</p>}
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

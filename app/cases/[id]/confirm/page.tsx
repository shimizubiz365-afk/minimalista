"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Phone, CalendarCheck, MapPin } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { splitAddress, combineAddress } from "@/lib/address";
import { staffColor } from "@/lib/staffColor";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputClass, textareaClass } from "@/components/ui/field";

type Detail = {
  case: {
    id: string;
    status: string;
    visit_at: string | null;
    desired_items: string | null;
    memo: string | null;
    registered_by: string | null;
  };
  customer: { name: string; phone: string | null; address: string | null };
};
type Staff = { id: string; name: string };

export default function ConfirmReservation({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [d, setD] = useState<Detail>();
  const [zip, setZip] = useState("");
  const [addr, setAddr] = useState("");
  const [desired, setDesired] = useState("");
  const [visitAt, setVisitAt] = useState("");
  const [memo, setMemo] = useState("");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [assignee, setAssignee] = useState("");
  const [zipMsg, setZipMsg] = useState<string>();
  const [zipLoading, setZipLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>();

  // 郵便番号→住所。force=trueで上書き、falseは住所が空のときだけ補完（手入力の番地を消さない）。
  async function lookupZip(code: string, force = false) {
    const c = code.replace(/\D/g, "");
    if (c.length !== 7) return;
    setZipLoading(true);
    setZipMsg(undefined);
    const r = await apiFetch<{ found: boolean; address?: string }>(`/api/zip?code=${c}`);
    setZipLoading(false);
    if (r.ok && r.data?.found) {
      setAddr((prev) => (force || !prev.trim() ? r.data!.address! : prev));
    } else if (r.ok) {
      setZipMsg("該当する住所が見つかりませんでした");
    } else setZipMsg(r.error);
  }

  useEffect(() => {
    apiFetch<Staff[]>("/api/staff").then((r) => {
      if (r.ok) setStaff(r.data ?? []);
    });
    apiFetch<Detail>(`/api/cases/${id}`).then((r) => {
      if (r.ok && r.data) {
        setD(r.data);
        const sp = splitAddress(r.data.customer.address);
        setZip(sp.zip);
        setAddr(sp.rest);
        setDesired(r.data.case.desired_items ?? "");
        setVisitAt(r.data.case.visit_at ? r.data.case.visit_at.slice(0, 16) : "");
        setMemo(r.data.case.memo ?? "");
        setAssignee(r.data.case.registered_by ?? "");
        // 〒だけ分かっていて住所が空なら、開いた時点で都道府県市区町村まで自動補完
        if (sp.zip && !sp.rest) lookupZip(sp.zip);
      } else setMsg(r.error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function confirm() {
    if (!visitAt) {
      setMsg("訪問日時を入力してください");
      return;
    }
    setSaving(true);
    setMsg(undefined);
    const r = await apiFetch(`/api/cases/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify({
        address: combineAddress(zip, addr),
        desired_items: desired,
        visit_at: visitAt,
        memo,
        assigned_staff_id: assignee || undefined,
      }),
    });
    setSaving(false);
    if (r.ok) router.push("/");
    else setMsg(r.error);
  }

  return (
    <main className="pb-6">
      <AppHeader title="予約確定" backHref="/" />

      {!d && <p className="px-5 pt-6 text-sm text-muted">読み込み中…</p>}

      {d && (
        <>
          {/* 顧客（荷電先） */}
          <section className="px-5 pt-5">
            <Card>
              <p className="text-xs text-muted mb-1">荷電先</p>
              <h1 className="text-xl font-semibold mb-3">{d.customer.name} 様</h1>
              {d.customer.phone && (
                <a
                  href={`tel:${d.customer.phone}`}
                  className="w-full h-12 text-white rounded-md font-medium text-base flex items-center justify-center gap-2 bg-warning active:bg-warning/90"
                >
                  <Phone className="w-4 h-4" /> {d.customer.phone} に電話
                </a>
              )}
              <p className="text-xs text-subtle mt-3">
                電話で詳しい住所・ご要望・訪問日時を伺って入力 →「予約を確定」
              </p>
            </Card>
          </section>

          {/* 聞き取り入力 */}
          <section className="px-5 pt-4 space-y-4">
            <Field label="郵便番号">
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={zip}
                  onChange={(e) => {
                    const v = e.target.value;
                    setZip(v);
                    if (v.replace(/\D/g, "").length === 7 && !addr.trim()) lookupZip(v);
                  }}
                  placeholder="243-0027"
                />
                <button
                  type="button"
                  onClick={() => lookupZip(zip, true)}
                  disabled={zipLoading || zip.replace(/\D/g, "").length !== 7}
                  className="shrink-0 h-12 px-3 rounded-md border border-border bg-surface text-sm font-medium flex items-center gap-1 active:bg-border/40 disabled:opacity-50"
                >
                  <MapPin className="w-4 h-4" />
                  {zipLoading ? "検索中" : "住所"}
                </button>
              </div>
              {zipMsg && <span className="text-xs text-danger mt-1 block">{zipMsg}</span>}
            </Field>

            <Field label="住所">
              <input
                className={inputClass}
                value={addr}
                onChange={(e) => setAddr(e.target.value)}
                placeholder="都道府県・市区町村・番地・建物名・部屋番号"
              />
            </Field>

            <Field label="ご要望・相談内容">
              <textarea
                className={textareaClass}
                rows={3}
                value={desired}
                onChange={(e) => setDesired(e.target.value)}
                placeholder="手放したいもの・お困りごとなど"
              />
            </Field>

            <Field label="訪問日時" required>
              <input
                type="datetime-local"
                className={inputClass}
                value={visitAt}
                onChange={(e) => setVisitAt(e.target.value)}
              />
            </Field>

            <Field label="担当者">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0 border border-border"
                  style={{ backgroundColor: staffColor(assignee) }}
                />
                <select
                  className={inputClass}
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">未割り当て</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </Field>

            <Field label="メモ（任意）">
              <textarea
                className={textareaClass}
                rows={2}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="通話メモ・注意点など"
              />
            </Field>
          </section>

          {msg && <p className="px-5 pt-4 text-sm text-danger">{msg}</p>}

          {/* 確定ボタン（フォーム末尾にインライン配置＝下部UIに隠れない） */}
          <div className="px-5 pt-5 pb-10">
            <Button onClick={confirm} loading={saving} loadingText="確定中…" size="lg">
              <CalendarCheck className="w-5 h-5" /> 予約を確定する
            </Button>
          </div>
        </>
      )}
    </main>
  );
}

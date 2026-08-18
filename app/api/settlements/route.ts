import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sumAmounts, sumWorkFees, netAmount } from "@/lib/money";
import { buildDaichoRows } from "@/lib/settlement";
import { computeReferralFee } from "@/lib/fee";
import { sheetsEnabled, appendSalesRow } from "@/lib/gsheets";

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { case_id, cash_settled } = await req.json();
  if (!case_id || typeof cash_settled !== "number")
    return fail("case_id / cash_settled は必須", 400);
  const db = supabaseAdmin();

  // 二重確定防止
  const existing = await db
    .from("settlements")
    .select("id")
    .eq("case_id", case_id)
    .maybeSingle();
  if (existing.data) return fail("既に精算確定済みです", 409);

  // 案件 + 顧客 + 確認情報
  const c = await db
    .from("cases")
    .select(
      "id, verification_method, id_media_id, referrer_ambassador_id, registered_by, customer:customers(name,address,occupation,birth_year,customer_no,phone)"
    )
    .eq("id", case_id)
    .maybeSingle();
  if (c.error || !c.data) return fail("案件が見つかりません", 404);
  const cust = (
    c.data as unknown as {
      customer: {
        name: string;
        address: string | null;
        occupation: string | null;
        birth_year: number | null;
        customer_no: string | null;
        phone: string | null;
      };
    }
  ).customer;
  const cmeta = c.data as unknown as {
    verification_method: string | null;
    id_media_id: string | null;
  };

  const pis = await db
    .from("purchase_items")
    .select("id,name,brand,model,condition,amount")
    .eq("case_id", case_id)
    .order("created_at");
  if (pis.error) return fail(pis.error.message, 500);
  const purchaseItems = pis.data ?? [];

  const cis = await db.from("collection_items").select("work_fee").eq("case_id", case_id);
  if (cis.error) return fail(cis.error.message, 500);

  // 本人確認の状態（買取がある場合のみ古物営業法で必要）。
  // ハードブロックはしない（業務を止めない）。未了なら台帳は作らず警告を返す。
  const needsVerification = purchaseItems.length > 0;
  const verificationComplete = Boolean(
    cmeta.verification_method && cust.occupation && cust.birth_year
  );

  const buy_total = sumAmounts(purchaseItems);
  const work_total = sumWorkFees(cis.data ?? []);
  const net_amount = netAmount(buy_total, work_total);

  // settlements
  const st = await db
    .from("settlements")
    .insert({
      case_id,
      buy_total,
      work_total,
      net_amount,
      cash_settled,
      settled_by: guard.staff.id,
    })
    .select("id")
    .single();
  if (st.error) return fail(st.error.message, 500);

  // 古物台帳（買取明細があり、かつ本人確認が完了している場合のみ生成）
  let daicho_count = 0;
  if (purchaseItems.length > 0 && verificationComplete) {
    const txDate = new Date().toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear();
    const rows = buildDaichoRows({
      caseId: case_id,
      purchaseItems,
      customer: cust,
      verificationMethod: cmeta.verification_method,
      idMediaId: cmeta.id_media_id,
      txDate,
      currentYear,
    });
    const ins = await db.from("kobutsu_daicho").insert(rows);
    if (ins.error) return fail("台帳生成に失敗: " + ins.error.message, 500);
    daicho_count = rows.length;
  }

  // 紹介フィー自動生成（紹介案件のみ・冪等）
  let referral_fee_total: number | null = null;
  const refAmbId = (c.data as unknown as { referrer_ambassador_id: string | null })
    .referrer_ambassador_id;
  if (refAmbId) {
    const dup = await db.from("referral_fees").select("id").eq("case_id", case_id).maybeSingle();
    if (!dup.data) {
      const fs = await db
        .from("fee_settings")
        .select("rate_buy,rate_work,tk_share")
        .lte("effective_from", new Date().toISOString().slice(0, 10))
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();
      const amb = await db.from("ambassadors").select("id,tk_id").eq("id", refAmbId).maybeSingle();
      if (fs.data && amb.data) {
        const fee = computeReferralFee({
          buyTotal: buy_total,
          workTotal: work_total,
          rateBuy: Number(fs.data.rate_buy),
          rateWork: Number(fs.data.rate_work),
          tkShare: Number(fs.data.tk_share),
          ambassadorId: amb.data.id,
          ambassadorTkId: amb.data.tk_id ?? null,
        });
        const fins = await db.from("referral_fees").insert({
          case_id,
          ambassador_id: amb.data.id,
          tk_id: amb.data.tk_id ?? null,
          fee_buy: fee.fee_buy,
          fee_work: fee.fee_work,
          fee_total: fee.fee_total,
          pay_to: fee.pay_to,
          pay_to_id: fee.pay_to_id,
          tk_portion: fee.tk_portion,
          ambassador_portion: fee.ambassador_portion,
          accrued_at: new Date().toISOString(),
        });
        if (!fins.error) referral_fee_total = fee.fee_total;
      }
    }
  }

  // クローズ
  const cl = await db
    .from("cases")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", case_id);
  if (cl.error) return fail(cl.error.message, 500);

  // 担当者名（cases.registered_by → staff.name）。売上の誰の数字か分かるように。
  const assigneeId = (c.data as unknown as { registered_by: string | null }).registered_by;
  let staffName = "";
  if (assigneeId) {
    const sname = await db.from("staff").select("name").eq("id", assigneeId).maybeSingle();
    staffName = sname.data?.name ?? "";
  }

  // GENBA 管理表「売上」タブへ1行追記（任意・失敗しても精算は成立）
  if (sheetsEnabled()) {
    try {
      await appendSalesRow({
        date: new Date().toISOString().slice(0, 10),
        caseId: case_id,
        customerNo: cust.customer_no ?? "",
        customerName: cust.name,
        phone: cust.phone ?? "",
        buyTotal: buy_total,
        workTotal: work_total,
        net: net_amount,
        cashSettled: cash_settled,
        referralFee: referral_fee_total,
        staffName,
        status: "精算済み",
      });
    } catch {
      // シート連携は任意。エラーは無視。
    }
  }

  const warning =
    needsVerification && !verificationComplete
      ? "本人確認が未了のため、古物台帳は未生成です。買取は本人確認の完了が必要です（後から実施してください）。"
      : null;

  return ok({
    buy_total,
    work_total,
    net_amount,
    cash_settled,
    daicho_count,
    referral_fee_total,
    warning,
  });
}

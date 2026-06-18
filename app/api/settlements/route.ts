import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sumAmounts, sumWorkFees, netAmount } from "@/lib/money";
import { buildDaichoRows } from "@/lib/settlement";
import { computeReferralFee } from "@/lib/fee";

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
      "id, verification_method, id_media_id, referrer_ambassador_id, customer:customers(name,address,occupation,birth_year)"
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

  // 買取があるなら本人確認必須
  if (purchaseItems.length > 0) {
    if (!cmeta.verification_method || !cust.occupation || !cust.birth_year) {
      return fail("本人確認が未完了です（確認方法・職業・生年・身分証）", 400);
    }
  }

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

  // 古物台帳（買取明細がある場合のみ）
  let daicho_count = 0;
  if (purchaseItems.length > 0) {
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

  return ok({ buy_total, work_total, net_amount, cash_settled, daicho_count, referral_fee_total });
}

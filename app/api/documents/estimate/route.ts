import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { renderToBuffer } from "@/lib/pdf/renderToBuffer";
import { Estimate } from "@/lib/pdf/estimate";
import { sumAmounts, sumWorkFees, netAmount } from "@/lib/money";
import { storePdf } from "@/lib/pdf/issue";

type Cust = { name: string; address: string | null; customer_no: string };

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { case_id } = await req.json();
  if (!case_id) return fail("case_id は必須", 400);
  const db = supabaseAdmin();
  const c = await db
    .from("cases")
    .select("id, customer:customers(name,address,customer_no)")
    .eq("id", case_id)
    .maybeSingle();
  if (c.error || !c.data) return fail("案件が見つかりません", 404);

  const buy = await db
    .from("purchase_items")
    .select("name,amount")
    .eq("case_id", case_id)
    .order("created_at");
  if (buy.error) return fail(buy.error.message, 500);
  const work = await db
    .from("collection_items")
    .select("item_name,work_fee")
    .eq("case_id", case_id)
    .order("created_at");
  if (work.error) return fail(work.error.message, 500);

  const buyItems = buy.data ?? [];
  const collectionItems = work.data ?? [];
  if (buyItems.length === 0 && collectionItems.length === 0)
    return fail("見積もりの明細がありません", 400);

  const buyTotal = sumAmounts(buyItems);
  const workTotal = sumWorkFees(collectionItems);
  const cust = (c.data as unknown as { customer: Cust }).customer;
  try {
    const buf = await renderToBuffer(
      Estimate({
        customer: { name: cust.name, address: cust.address, customer_no: cust.customer_no },
        buyItems,
        collectionItems,
        buyTotal,
        workTotal,
        net: netAmount(buyTotal, workTotal),
        date: new Date().toISOString().slice(0, 10),
        staffName: guard.staff.name,
      })
    );
    const res = await storePdf(case_id, "estimate", buf);
    return ok(res);
  } catch (e) {
    return fail("PDF生成または保存に失敗しました: " + (e as Error).message, 500);
  }
}

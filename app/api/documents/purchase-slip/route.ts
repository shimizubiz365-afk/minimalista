import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { renderToBuffer } from "@/lib/pdf/renderToBuffer";
import { PurchaseSlip } from "@/lib/pdf/purchaseSlip";
import { sumAmounts } from "@/lib/money";
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
  const items = await db
    .from("purchase_items")
    .select("name,brand,model,condition,amount")
    .eq("case_id", case_id)
    .order("created_at");
  if (items.error) return fail(items.error.message, 500);
  const list = items.data ?? [];
  if (list.length === 0) return fail("買取明細がありません", 400);
  const total = sumAmounts(list);
  const cust = (c.data as unknown as { customer: Cust }).customer;
  try {
    const buf = await renderToBuffer(
      PurchaseSlip({
        customer: { name: cust.name, address: cust.address, customer_no: cust.customer_no },
        items: list,
        total,
        date: new Date().toISOString().slice(0, 10),
        staffName: guard.staff.name,
      })
    );
    const res = await storePdf(case_id, "purchase_slip", buf);
    return ok(res);
  } catch (e) {
    return fail("PDF生成または保存に失敗しました: " + (e as Error).message, 500);
  }
}

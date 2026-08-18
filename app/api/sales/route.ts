import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { grossProfit } from "@/lib/money";
import { appendProductSaleRow, sheetsEnabled } from "@/lib/gsheets";
import { CHANNEL_LABELS, label } from "@/lib/labels";

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const b = await req.json();
  if (!b.product_id || typeof b.sale_price !== "number" || !b.sold_at)
    return fail("product_id / sale_price / sold_at は必須", 400);
  const db = supabaseAdmin();

  const p = await db
    .from("products")
    .select(
      "id,name,status,cost,acquired_case_id,acquired_customer:customers!products_acquired_customer_id_fkey(customer_no,name)"
    )
    .eq("id", b.product_id)
    .maybeSingle();
  if (p.error || !p.data) return fail("商品が見つかりません", 404);
  if (p.data.status === "sold") return fail("既に売却済です", 409);

  const gross = grossProfit(b.sale_price, p.data.cost);
  const sale = await db
    .from("sales")
    .insert({
      product_id: b.product_id,
      sale_price: b.sale_price,
      channel: b.channel ?? null,
      sold_at: b.sold_at,
      gross_profit: gross,
      created_by: guard.staff.id,
    })
    .select("id")
    .single();
  if (sale.error) return fail(sale.error.message, 500);

  const up = await db
    .from("products")
    .update({ status: "sold", sold_at: new Date().toISOString() })
    .eq("id", b.product_id);
  if (up.error) return fail(up.error.message, 500);

  // 担当者＝買い取った案件の担当者（cases.registered_by）。出品者ではなく元の営業の売上に付ける。
  let staffName = "";
  if (p.data.acquired_case_id) {
    const cs = await db
      .from("cases")
      .select("registered_by")
      .eq("id", p.data.acquired_case_id)
      .maybeSingle();
    const sid = cs.data?.registered_by as string | null | undefined;
    if (sid) {
      const sn = await db.from("staff").select("name").eq("id", sid).maybeSingle();
      staffName = sn.data?.name ?? "";
    }
  }

  // 物販タブに1行追記（顧客に紐づく利益。失敗しても売却は成立＝任意連携）。
  let productCode: string | null = null;
  if (sheetsEnabled()) {
    try {
      const cust = p.data.acquired_customer as
        | { customer_no?: string; name?: string }
        | { customer_no?: string; name?: string }[]
        | null;
      const c = Array.isArray(cust) ? cust[0] : cust;
      productCode = await appendProductSaleRow({
        productName: p.data.name,
        acquiredCustomerNo: c?.customer_no ?? "",
        customerName: c?.name ?? "",
        staffName,
        cost: p.data.cost,
        salePrice: b.sale_price,
        profit: gross,
        channelLabel: b.channel ? label(CHANNEL_LABELS, b.channel) : "",
        soldAt: b.sold_at,
        caseId: p.data.acquired_case_id ?? "",
      });
    } catch (e) {
      console.error("[sales] 物販タブ追記に失敗:", e);
    }
  }

  return ok({ id: sale.data.id, gross_profit: gross, product_code: productCode });
}

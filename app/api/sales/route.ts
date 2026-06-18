import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { grossProfit } from "@/lib/money";

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const b = await req.json();
  if (!b.product_id || typeof b.sale_price !== "number" || !b.sold_at)
    return fail("product_id / sale_price / sold_at は必須", 400);
  const db = supabaseAdmin();

  const p = await db.from("products").select("id,status,cost").eq("id", b.product_id).maybeSingle();
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

  return ok({ id: sale.data.id, gross_profit: gross });
}

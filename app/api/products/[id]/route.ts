import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const db = supabaseAdmin();
  const [p, src, sale] = await Promise.all([
    db.from("products").select("*").eq("id", id).maybeSingle(),
    db
      .from("product_source_items")
      .select("purchase_item_id, purchase_items(name,amount)")
      .eq("product_id", id),
    db.from("sales").select("*").eq("product_id", id).maybeSingle(),
  ]);
  if (p.error || !p.data) return fail("商品が見つかりません", 404);
  return ok({ product: p.data, sources: src.data ?? [], sale: sale.data ?? null });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const b = await req.json();
  const db = supabaseAdmin();
  const cur = await db.from("products").select("status").eq("id", id).maybeSingle();
  if (cur.error || !cur.data) return fail("商品が見つかりません", 404);

  const patch: Record<string, unknown> = {};
  if (typeof b.name === "string") patch.name = b.name;
  if (typeof b.cost === "number") patch.cost = b.cost;
  if (b.status === "listed") {
    patch.status = "listed";
    patch.listed_at = new Date().toISOString();
  }
  if (b.status === "in_stock") patch.status = "in_stock";
  if (cur.data.status === "sold" && ("cost" in patch || "name" in patch))
    return fail("売却済の商品は変更できません", 400);
  if (Object.keys(patch).length === 0) return fail("変更項目がありません", 400);

  const { error } = await db.from("products").update(patch).eq("id", id);
  if (error) return fail(error.message, 500);
  return ok({ id });
}

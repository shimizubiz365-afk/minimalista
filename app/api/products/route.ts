import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const caseId = url.searchParams.get("case_id");
  let q = supabaseAdmin()
    .from("products")
    .select(
      "id,name,status,cost,created_at,acquired_customer:customers!products_acquired_customer_id_fkey(name)"
    )
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  if (caseId) q = q.eq("acquired_case_id", caseId);
  const { data, error } = await q;
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const b = await req.json();
  if (!b.case_id || !b.name || typeof b.cost !== "number")
    return fail("case_id / name / cost は必須", 400);
  const sources: string[] = b.source_purchase_item_ids ?? [];
  if (sources.length === 0) return fail("源泉の買取明細を1つ以上選んでください", 400);
  const db = supabaseAdmin();

  const c = await db.from("cases").select("id, customer_id").eq("id", b.case_id).maybeSingle();
  if (c.error || !c.data) return fail("案件が見つかりません", 404);

  const firstItem = await db
    .from("purchase_items")
    .select("created_by")
    .eq("id", sources[0])
    .maybeSingle();
  const acquiredBy = firstItem.data?.created_by ?? guard.staff.id;

  const prod = await db
    .from("products")
    .insert({
      name: b.name,
      cost: b.cost,
      condition: b.condition ?? null,
      acquired_case_id: b.case_id,
      acquired_customer_id: c.data.customer_id,
      acquired_by_staff_id: acquiredBy,
    })
    .select("id")
    .single();
  if (prod.error) return fail(prod.error.message, 500);

  const rows = sources.map((pid) => ({ product_id: prod.data.id, purchase_item_id: pid }));
  const link = await db.from("product_source_items").insert(rows);
  if (link.error) return fail(link.error.message, 500);

  return ok({ id: prod.data.id });
}

import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const b = await req.json();
  if (!b.case_id || !b.name || typeof b.amount !== "number")
    return fail("case_id / name / amount は必須", 400);
  const { data, error } = await supabaseAdmin()
    .from("purchase_items")
    .insert({
      case_id: b.case_id,
      name: b.name,
      brand: b.brand ?? null,
      model: b.model ?? null,
      condition: b.condition ?? null,
      amount: b.amount,
      created_by: guard.staff.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message, 500);
  return ok({ id: data.id });
}

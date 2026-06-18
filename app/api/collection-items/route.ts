import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const b = await req.json();
  if (!b.case_id || !b.item_name || typeof b.work_fee !== "number")
    return fail("case_id / item_name / work_fee は必須", 400);
  const { data, error } = await supabaseAdmin()
    .from("collection_items")
    .insert({
      case_id: b.case_id,
      item_name: b.item_name,
      work_fee: b.work_fee,
      created_by: guard.staff.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message, 500);
  return ok({ id: data.id });
}

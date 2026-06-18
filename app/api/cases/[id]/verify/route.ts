import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const b = await req.json();
  if (!b.verification_method || !b.occupation || typeof b.birth_year !== "number")
    return fail("確認方法・職業・生年は必須", 400);

  const db = supabaseAdmin();
  const c = await db.from("cases").select("id, customer_id").eq("id", id).maybeSingle();
  if (c.error || !c.data) return fail("案件が見つかりません", 404);

  const upCust = await db
    .from("customers")
    .update({ occupation: b.occupation, birth_year: b.birth_year })
    .eq("id", c.data.customer_id);
  if (upCust.error) return fail(upCust.error.message, 500);

  const upCase = await db
    .from("cases")
    .update({ verification_method: b.verification_method, id_media_id: b.id_media_id ?? null })
    .eq("id", id);
  if (upCase.error) return fail(upCase.error.message, 500);

  return ok({ ok: true });
}

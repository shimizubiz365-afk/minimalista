import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 精算確定(closed)済みの案件は明細を編集させない
async function ensureEditable(itemId: string): Promise<string | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("collection_items")
    .select("case_id, case:cases(status)")
    .eq("id", itemId)
    .maybeSingle();
  const status = (data as { case?: { status?: string } } | null)?.case?.status;
  if (!data) return "明細が見つかりません";
  if (status === "closed") return "精算確定済みのため編集できません";
  return null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const err = await ensureEditable(id);
  if (err) return fail(err, 400);
  const b = await req.json();
  const patch: Record<string, unknown> = {};
  if (b.item_name !== undefined) patch.item_name = b.item_name;
  if (b.work_fee !== undefined) {
    if (typeof b.work_fee !== "number") return fail("work_fee は数値", 400);
    patch.work_fee = b.work_fee;
  }
  if (Object.keys(patch).length === 0) return fail("更新項目がありません", 400);
  const { error } = await supabaseAdmin()
    .from("collection_items")
    .update(patch)
    .eq("id", id);
  if (error) return fail(error.message, 500);
  return ok({ id });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const err = await ensureEditable(id);
  if (err) return fail(err, 400);
  const { error } = await supabaseAdmin()
    .from("collection_items")
    .delete()
    .eq("id", id);
  if (error) return fail(error.message, 500);
  return ok({ id });
}

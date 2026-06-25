import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 精算確定(closed)済みの案件は明細を編集させない（台帳生成済みのため）
async function ensureEditable(itemId: string): Promise<string | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("purchase_items")
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
  if (b.name !== undefined) patch.name = b.name;
  if (b.brand !== undefined) patch.brand = b.brand || null;
  if (b.model !== undefined) patch.model = b.model || null;
  if (b.condition !== undefined) patch.condition = b.condition || null;
  if (b.amount !== undefined) {
    if (typeof b.amount !== "number") return fail("amount は数値", 400);
    patch.amount = b.amount;
  }
  if (Object.keys(patch).length === 0) return fail("更新項目がありません", 400);
  const { error } = await supabaseAdmin()
    .from("purchase_items")
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
    .from("purchase_items")
    .delete()
    .eq("id", id);
  if (error) return fail(error.message, 500);
  return ok({ id });
}

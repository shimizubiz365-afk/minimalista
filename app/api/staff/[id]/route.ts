import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// スタッフの承認・停止。有効なスタッフなら誰でも操作できる（少人数運用のため役割列は設けない）。
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const b = await req.json();
  if (typeof b.active !== "boolean") return fail("active は必須", 400);

  // 自分自身の停止は事故のもとなので塞ぐ
  if (id === guard.staff.id && !b.active)
    return fail("自分自身は停止できません", 400);

  const { data, error } = await supabaseAdmin()
    .from("staff")
    .update({ active: b.active })
    .eq("id", id)
    .select("id,name,active")
    .maybeSingle();
  if (error) return fail(error.message, 500);
  if (!data) return fail("スタッフが見つかりません", 404);
  return ok(data);
}

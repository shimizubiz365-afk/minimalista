import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ログイン中スタッフ（アカウント設定）
export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { data, error } = await supabaseAdmin()
    .from("staff")
    .select("id,name,line_user_id,active")
    .eq("id", guard.staff.id)
    .maybeSingle();
  if (error || !data) return fail("アカウントが見つかりません", 404);
  return ok(data);
}

export async function PATCH(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const b = await req.json();
  if (typeof b.name !== "string" || !b.name.trim()) return fail("表示名を入力してください", 400);
  const { data, error } = await supabaseAdmin()
    .from("staff")
    .update({ name: b.name.trim() })
    .eq("id", guard.staff.id)
    .select("id,name")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}

import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 有効なスタッフ一覧（担当者セレクタ・カレンダーの色凡例に使用）
export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { data, error } = await supabaseAdmin()
    .from("staff")
    .select("id,name")
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (error) return fail(error.message, 500);
  return ok(data);
}

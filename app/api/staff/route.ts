import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// スタッフ一覧。既定は有効なスタッフ（担当者セレクタ・カレンダーの色凡例に使用）。
// ?status=pending で承認待ち（active=false）を返す。
export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const pending = new URL(req.url).searchParams.get("status") === "pending";
  const { data, error } = await supabaseAdmin()
    .from("staff")
    .select("id,name")
    .eq("active", !pending)
    .order("created_at", { ascending: true });
  if (error) return fail(error.message, 500);
  return ok(data);
}

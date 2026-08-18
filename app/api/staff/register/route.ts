import { ok, fail } from "@/lib/api";
import { verifyIdToken } from "@/lib/liffAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 未登録の従業員が自分で登録を申請する受け口。
// staff 行がまだ無いので requireStaff は通れない＝LINE IDトークンの検証だけで通す。
// 作られる行は必ず active=false。承認されるまで他のAPIは一切通らないので、
// LIFFのURLを知っている誰かが叩いても実害は「承認待ちの行が1件増える」だけ。
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return fail("認証トークンがありません", 401);

  const verified = await verifyIdToken(token);
  if (!verified) return fail("LINEの認証に失敗しました", 401);

  const body = await req.json().catch(() => ({}));
  const name =
    typeof body.name === "string" && body.name.trim() ? body.name.trim() : "名称未設定";

  const db = supabaseAdmin();
  const ex = await db
    .from("staff")
    .select("id,name,active")
    .eq("line_user_id", verified.lineUserId)
    .maybeSingle();
  if (ex.error) return fail(ex.error.message, 500);

  // 申請済み（承認待ち or 承認済み）なら二重に作らない
  if (ex.data)
    return ok({ status: ex.data.active ? "active" : "pending", name: ex.data.name });

  const ins = await db
    .from("staff")
    .insert({ line_user_id: verified.lineUserId, name, active: false })
    .select("name")
    .single();
  if (ins.error) return fail(ins.error.message, 500);
  return ok({ status: "pending", name: ins.data.name });
}

import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const url = new URL(req.url);
  const db = supabaseAdmin();
  const cols = "id,customer_no,name,name_kana,phone,address";

  // q: 氏名・カナ・電話の部分一致（再訪問の顧客検索）
  const q = url.searchParams.get("q")?.trim();
  if (q !== null && q !== undefined && q !== "") {
    // PostgREST の or() 構文を壊す文字を除去
    const safe = q.replace(/[,()*%]/g, "").trim();
    if (!safe) return ok([]);
    const { data, error } = await db
      .from("customers")
      .select(cols)
      .or(`name.ilike.%${safe}%,name_kana.ilike.%${safe}%,phone.ilike.%${safe}%`)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return fail(error.message, 500);
    return ok(data);
  }

  // phone: 完全一致（既存の予約登録フローが利用）
  const phone = url.searchParams.get("phone")?.trim();
  if (!phone) return ok([]);
  const { data, error } = await db.from("customers").select(cols).eq("phone", phone).limit(10);
  if (error) return fail(error.message, 500);
  return ok(data);
}

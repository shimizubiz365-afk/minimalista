import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 荷電後の予約確定。詳しい住所(顧客)・要望/エリア(案件)を補完し、訪問日時をセットして予約を確定する。
// statusはreservedのまま＝visit_atが入ることでホームの「今日の訪問」に乗る。
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const b = await req.json();
  if (!b.visit_at) return fail("訪問日時を入力してください", 400);
  const db = supabaseAdmin();

  const c = await db.from("cases").select("id, customer_id").eq("id", id).maybeSingle();
  if (c.error || !c.data) return fail("案件が見つかりません", 404);

  // 顧客の住所を更新（詳しい住所を聞き出した場合）
  if (typeof b.address === "string") {
    const cu = await db
      .from("customers")
      .update({ address: b.address.trim() || null })
      .eq("id", c.data.customer_id);
    if (cu.error) return fail(cu.error.message, 500);
  }

  // 案件: 訪問日時・要望・エリア・メモ・担当者を確定
  // 担当者は専用列が無いため registered_by(登録者列)に保存（アプリ内で他用途に読まれていない）
  const patch: Record<string, unknown> = { visit_at: b.visit_at };
  if (typeof b.desired_items === "string") patch.desired_items = b.desired_items.trim() || null;
  if (typeof b.area === "string") patch.area = b.area.trim() || null;
  if (typeof b.memo === "string") patch.memo = b.memo.trim() || null;
  if (typeof b.assigned_staff_id === "string" && b.assigned_staff_id) {
    patch.registered_by = b.assigned_staff_id;
  }

  const up = await db
    .from("cases")
    .update(patch)
    .eq("id", id)
    .select("id,visit_at,status")
    .single();
  if (up.error) return fail(up.error.message, 500);

  return ok({ id, visit_at: up.data.visit_at });
}

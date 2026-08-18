import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 顧客詳細＋その顧客の案件一覧（再訪問の起点）
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const db = supabaseAdmin();
  const [c, cs] = await Promise.all([
    db
      .from("customers")
      .select("id,customer_no,name,name_kana,phone,address")
      .eq("id", id)
      .maybeSingle(),
    db
      .from("cases")
      .select("id,status,visit_at,desired_items,created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (c.error || !c.data) return fail("顧客が見つかりません", 404);
  return ok({ customer: c.data, cases: cs.data ?? [] });
}

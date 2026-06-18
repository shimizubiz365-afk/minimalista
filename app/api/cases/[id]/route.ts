import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const db = supabaseAdmin();
  const [c, logs, pi, ci] = await Promise.all([
    db.from("cases").select("*, customer:customers(*)").eq("id", id).maybeSingle(),
    db.from("call_logs").select("*").eq("case_id", id).order("called_at", { ascending: false }),
    db.from("purchase_items").select("*").eq("case_id", id).order("created_at"),
    db.from("collection_items").select("*").eq("case_id", id).order("created_at"),
  ]);
  if (c.error || !c.data) return fail("案件が見つかりません", 404);
  return ok({
    case: c.data,
    customer: (c.data as { customer: unknown }).customer,
    call_logs: logs.data ?? [],
    purchase_items: pi.data ?? [],
    collection_items: ci.data ?? [],
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const body = await req.json();
  const allowed = ["reserved", "visiting", "visited", "pending_pickup", "closed", "cancelled"];
  if (!allowed.includes(body.status)) return fail("不正なステータス", 400);
  const patch: Record<string, unknown> = { status: body.status };
  if (body.status === "closed") patch.closed_at = new Date().toISOString();
  const { data, error } = await supabaseAdmin()
    .from("cases")
    .update(patch)
    .eq("id", id)
    .select("id,status")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data);
}

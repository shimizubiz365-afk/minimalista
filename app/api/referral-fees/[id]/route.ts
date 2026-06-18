import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const b = await req.json();
  if (b.status !== "paid") return fail("status は paid のみ", 400);
  const { error } = await supabaseAdmin()
    .from("referral_fees")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return fail(error.message, 500);
  return ok({ id });
}

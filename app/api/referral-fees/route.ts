import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const status = new URL(req.url).searchParams.get("status");
  let q = supabaseAdmin()
    .from("referral_fees")
    .select(
      "id,fee_total,pay_to,tk_portion,ambassador_portion,status,accrued_at,ambassador:ambassadors(name),tk:tk(name)"
    )
    .order("accrued_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return fail(error.message, 500);
  return ok(data);
}

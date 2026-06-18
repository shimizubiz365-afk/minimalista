import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { data, error } = await supabaseAdmin()
    .from("fee_settings")
    .select("*")
    .order("effective_from", { ascending: false });
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const b = await req.json();
  for (const k of ["rate_buy", "rate_work", "tk_share", "ambassador_share"]) {
    if (typeof b[k] !== "number") return fail(`${k} は数値必須`, 400);
  }
  if (!b.effective_from) return fail("effective_from は必須", 400);
  const { data, error } = await supabaseAdmin()
    .from("fee_settings")
    .insert({
      rate_buy: b.rate_buy,
      rate_work: b.rate_work,
      tk_share: b.tk_share,
      ambassador_share: b.ambassador_share,
      effective_from: b.effective_from,
    })
    .select("id")
    .single();
  if (error) return fail(error.message, 500);
  return ok({ id: data.id });
}

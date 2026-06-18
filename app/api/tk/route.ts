import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { data, error } = await supabaseAdmin()
    .from("tk")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const b = await req.json();
  if (!b.name) return fail("name は必須", 400);
  const { data, error } = await supabaseAdmin()
    .from("tk")
    .insert({ name: b.name, contact: b.contact ?? null, payment_info: b.payment_info ?? null })
    .select("id")
    .single();
  if (error) return fail(error.message, 500);
  return ok({ id: data.id });
}

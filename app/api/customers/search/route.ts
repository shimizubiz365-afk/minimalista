import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const phone = new URL(req.url).searchParams.get("phone")?.trim();
  if (!phone) return ok([]);
  const { data, error } = await supabaseAdmin()
    .from("customers")
    .select("id,customer_no,name,name_kana,phone,address")
    .eq("phone", phone)
    .limit(10);
  if (error) return fail(error.message, 500);
  return ok(data);
}

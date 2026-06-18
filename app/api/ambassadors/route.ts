import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { data, error } = await supabaseAdmin()
    .from("ambassadors")
    .select("id,name,route_code,active,tk:tk(id,name)")
    .order("created_at", { ascending: false });
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const b = await req.json();
  if (!b.name || !b.route_code) return fail("name / route_code は必須", 400);
  const { data, error } = await supabaseAdmin()
    .from("ambassadors")
    .insert({ name: b.name, route_code: b.route_code, tk_id: b.tk_id ?? null })
    .select("id")
    .single();
  if (error)
    return fail(
      error.message.includes("duplicate") ? "route_code が重複しています" : error.message,
      400
    );
  return ok({ id: data.id });
}

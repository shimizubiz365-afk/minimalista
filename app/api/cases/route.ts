import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const status = new URL(req.url).searchParams.get("status");
  let q = supabaseAdmin()
    .from("cases")
    .select(
      "id,status,visit_at,area,desired_items,source,memo,customer:customers(id,customer_no,name,phone)"
    )
    .order("visit_at", { ascending: true });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const body = await req.json();
  const db = supabaseAdmin();

  let customerId: string | undefined = body.customer?.existing_id;
  if (!customerId) {
    const { data: c, error: cErr } = await db
      .from("customers")
      .insert({
        name: body.customer.name,
        name_kana: body.customer.name_kana ?? null,
        phone: body.customer.phone ?? null,
        address: body.customer.address ?? null,
      })
      .select("id")
      .single();
    if (cErr) return fail(cErr.message, 500);
    customerId = c.id;
  }

  const { data, error } = await db
    .from("cases")
    .insert({
      customer_id: customerId,
      visit_at: body.visit_at ?? null,
      area: body.area ?? null,
      desired_items: body.desired_items ?? null,
      source: body.source,
      referrer_ambassador_id: body.referrer_ambassador_id ?? null,
      registered_by: guard.staff.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message, 500);
  return ok({ id: data.id });
}

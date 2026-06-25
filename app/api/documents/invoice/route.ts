import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { renderToBuffer } from "@/lib/pdf/renderToBuffer";
import { Invoice } from "@/lib/pdf/invoice";
import { sumWorkFees, taxBreakdown, type TaxMode } from "@/lib/money";
import { storePdf } from "@/lib/pdf/issue";

type Cust = { name: string; address: string | null; customer_no: string };

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { case_id, tax_mode, due_date } = await req.json();
  if (!case_id) return fail("case_id は必須", 400);
  const mode: TaxMode = tax_mode === "inclusive" ? "inclusive" : "exclusive";
  const db = supabaseAdmin();
  const c = await db
    .from("cases")
    .select("id, customer:customers(name,address,customer_no)")
    .eq("id", case_id)
    .maybeSingle();
  if (c.error || !c.data) return fail("案件が見つかりません", 404);
  const items = await db
    .from("collection_items")
    .select("item_name,work_fee")
    .eq("case_id", case_id)
    .order("created_at");
  if (items.error) return fail(items.error.message, 500);
  const list = items.data ?? [];
  if (list.length === 0) return fail("請求対象の明細がありません", 400);
  const tax = taxBreakdown(sumWorkFees(list), mode);
  const cust = (c.data as unknown as { customer: Cust }).customer;

  const today = new Date();
  const dueDate =
    typeof due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(due_date)
      ? due_date
      : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    const buf = await renderToBuffer(
      Invoice({
        customer: { name: cust.name, address: cust.address, customer_no: cust.customer_no },
        items: list,
        tax,
        taxMode: mode,
        date: today.toISOString().slice(0, 10),
        dueDate,
        staffName: guard.staff.name,
      })
    );
    const res = await storePdf(case_id, "invoice", buf);
    return ok(res);
  } catch (e) {
    return fail("PDF生成または保存に失敗しました: " + (e as Error).message, 500);
  }
}

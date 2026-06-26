import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sheetsEnabled, readSheet, updateCells } from "@/lib/gsheets";

// 予約リードタブの列: A流入元 B紹介元コード C氏名 D電話 E郵便番号 F住所 G状態 H取込済 I顧客番号
const TAB = "予約リード";

// 流入元テキスト → cases.source（enum: phone/line/email/referral に丸める。細かい区分はシート側に残す）
function mapSource(ryunyuu: string, hasReferrer: boolean): string {
  if (hasReferrer) return "referral";
  const s = (ryunyuu || "").toLowerCase();
  if (s.includes("電話") || s.includes("phone") || s.includes("tel")) return "phone";
  if (s.includes("メール") || s.includes("mail")) return "email";
  return "line"; // 既定（事前情報はLINEで取得する想定）
}

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  if (!sheetsEnabled()) return fail("スプレッドシート連携が未設定です", 400);

  const db = supabaseAdmin();
  let rows: string[][];
  try {
    rows = await readSheet(TAB);
  } catch (e) {
    return fail("予約リードの読み取りに失敗: " + (e as Error).message, 500);
  }

  let imported = 0;
  const errors: string[] = [];

  // rows[0] はヘッダ。データは2行目以降。
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const ryunyuu = r[0] ?? "";
    const refCode = (r[1] ?? "").trim();
    const name = (r[2] ?? "").trim();
    const phone = (r[3] ?? "").trim();
    const zip = (r[4] ?? "").trim();
    const addr = (r[5] ?? "").trim();
    const importedFlag = (r[7] ?? "").trim();

    if (importedFlag) continue; // 取込済はスキップ
    if (!name) continue; // 氏名が無い行はスキップ

    const fullAddr = [zip ? `〒${zip}` : "", addr].filter(Boolean).join(" ");
    try {
      const cins = await db
        .from("customers")
        .insert({ name, phone: phone || null, address: fullAddr || null })
        .select("id,customer_no")
        .single();
      if (cins.error) throw new Error(cins.error.message);

      const caseIns = await db
        .from("cases")
        .insert({
          customer_id: cins.data.id,
          status: "reserved",
          visit_at: null,
          source: mapSource(ryunyuu, Boolean(refCode)),
          registered_by: guard.staff.id,
        })
        .select("id")
        .single();
      if (caseIns.error) throw new Error(caseIns.error.message);

      // シート行に「✓取込済」と顧客番号を書き戻す（H列=取込済, I列=顧客番号）
      const rownum = i + 1; // 1-based
      await updateCells(`${TAB}!H${rownum}:I${rownum}`, [["✓", cins.data.customer_no]]);
      imported++;
    } catch (e) {
      errors.push(`${i + 1}行目(${name}): ${(e as Error).message}`);
    }
  }

  return ok({ imported, errors });
}

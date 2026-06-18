// デモモード（GitHub Pages プレビュー用）。NEXT_PUBLIC_DEMO=1 のときだけ作動。
// ログイン不要・ダミーデータで画面を見るための仕組み。本番では無効。
export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

type Resp<T> = { ok: boolean; data?: T; error?: string };

const DEMO_ID = "demo";

const customers = [
  { id: "c1", customer_no: "C-000001", name: "山田太郎", name_kana: "ヤマダタロウ", phone: "09011112222", address: "東京都新宿区1-2-3" },
];

const caseList = [
  { id: DEMO_ID, status: "reserved", visit_at: "2026-06-20T10:00", area: "新宿区", desired_items: "古い食器・時計", source: "phone", customer: { id: "c1", customer_no: "C-000001", name: "山田太郎", phone: "09011112222" } },
  { id: "case2", status: "reserved", visit_at: "2026-06-21T14:00", area: "渋谷区", desired_items: "ブランド品", source: "referral", customer: { id: "c2", customer_no: "C-000002", name: "佐藤花子", phone: "08033334444" } },
];

const caseDetail = {
  case: { id: DEMO_ID, status: "visited", visit_at: "2026-06-20T10:00", area: "新宿区", memo: null, verification_method: "運転免許証" },
  customer: { name: "山田太郎", customer_no: "C-000001", phone: "09011112222", address: "東京都新宿区1-2-3" },
  purchase_items: [
    { id: "p1", name: "押し入れ一式（まとめ買い）", amount: 10000 },
  ],
  collection_items: [
    { id: "col1", item_name: "古いソファ", work_fee: 5000 },
  ],
};

const productsInStock = [
  { id: DEMO_ID, name: "ブランドバッグ", cost: 4000, status: "in_stock", acquired_customer: { name: "山田太郎" } },
  { id: "prod2", name: "腕時計", cost: 3000, status: "in_stock", acquired_customer: { name: "山田太郎" } },
];

const productDetail = {
  product: { id: DEMO_ID, name: "ブランドバッグ", cost: 4000, status: "in_stock", condition: "美品" },
  sources: [{ purchase_item_id: "p1", purchase_items: { name: "押し入れ一式（まとめ買い）", amount: 10000 } }],
  sale: null,
};

const ambassadors = [
  { id: "amb1", name: "鈴木紹介人", route_code: "SUZUKI01", active: true, tk: { id: "tk1", name: "山本統括" } },
  { id: "amb2", name: "高橋直アンバ", route_code: "TAKA02", active: true, tk: null },
];

const tk = [{ id: "tk1", name: "山本統括", contact: "090-1111-0000", payment_info: "○○銀行" }];

const feeSettings = [
  { id: "f1", rate_buy: 0.05, rate_work: 0.1, tk_share: 0.6, ambassador_share: 0.4, effective_from: "2026-06-01" },
];

const referralFees = [
  { id: "rf1", fee_total: 7000, pay_to: "tk", tk_portion: 4200, ambassador_portion: 2800, status: "accrued", accrued_at: "2026-06-18", ambassador: { name: "鈴木紹介人" }, tk: { name: "山本統括" } },
  { id: "rf2", fee_total: 3000, pay_to: "ambassador", tk_portion: 0, ambassador_portion: 3000, status: "accrued", accrued_at: "2026-06-17", ambassador: { name: "高橋直アンバ" }, tk: null },
];

export function demoResponse<T>(path: string, init: RequestInit = {}): Resp<T> {
  const method = (init.method ?? "GET").toUpperCase();
  // 変更系はダミー成功を返す
  if (method !== "GET") {
    return { ok: true, data: { id: DEMO_ID, gross_profit: 0, daicho_count: 1, referral_fee_total: 7000, ok: true } as unknown as T };
  }
  const p = path.split("?")[0];
  const pick = (v: unknown): Resp<T> => ({ ok: true, data: v as T });

  if (p === "/api/cases") return pick(caseList);
  if (p.startsWith("/api/cases/") && p.endsWith("/products")) return pick({ purchase_items: caseDetail.purchase_items });
  if (p.startsWith("/api/cases/")) return pick(caseDetail);
  if (p === "/api/customers/search") return pick(customers);
  if (p === "/api/products") {
    if (path.includes("status=sold")) return pick([]);
    return pick(productsInStock);
  }
  if (p.startsWith("/api/products/")) return pick(productDetail);
  if (p === "/api/ambassadors") return pick(ambassadors);
  if (p === "/api/tk") return pick(tk);
  if (p === "/api/fee-settings") return pick(feeSettings);
  if (p === "/api/referral-fees") {
    if (path.includes("status=paid")) return pick([]);
    return pick(referralFees);
  }
  return pick([] as unknown as T);
}

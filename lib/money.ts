export function sumAmounts(items: { amount: number }[]): number {
  return items.reduce((acc, i) => acc + i.amount, 0);
}

export function sumWorkFees(items: { work_fee: number }[]): number {
  return items.reduce((acc, i) => acc + i.work_fee, 0);
}

// マイナス（値引き・サービス）は「−¥3,000」と出す。"¥-3,000" だと帳票で読み違えやすい。
export function formatYen(n: number): string {
  const sign = n < 0 ? "−" : "";
  return sign + "¥" + Math.abs(n).toLocaleString("ja-JP");
}

export function netAmount(buyTotal: number, workTotal: number): number {
  return buyTotal - workTotal;
}

export function grossProfit(salePrice: number, cost: number): number {
  return salePrice - cost;
}

export function sumCosts(products: { cost: number }[]): number {
  return products.reduce((acc, p) => acc + p.cost, 0);
}

export const TAX_RATE = 0.1; // 消費税(標準税率10%)

export type TaxMode = "exclusive" | "inclusive"; // 外税 / 内税
export type TaxBreakdown = { subtotal: number; tax: number; total: number };

// 外税: 入力額を税抜とみなし消費税を上乗せ。消費税は端数切り捨て。
export function taxExclusive(subtotal: number): TaxBreakdown {
  const tax = Math.floor(subtotal * TAX_RATE);
  return { subtotal, tax, total: subtotal + tax };
}

// 内税: 入力額を税込とみなし、内税額を逆算(税込×10/110, 端数切り捨て)。
export function taxInclusive(total: number): TaxBreakdown {
  const tax = Math.floor((total * 10) / 110);
  return { subtotal: total - tax, tax, total };
}

export function taxBreakdown(amount: number, mode: TaxMode): TaxBreakdown {
  return mode === "inclusive" ? taxInclusive(amount) : taxExclusive(amount);
}

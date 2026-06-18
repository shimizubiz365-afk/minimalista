export function sumAmounts(items: { amount: number }[]): number {
  return items.reduce((acc, i) => acc + i.amount, 0);
}

export function sumWorkFees(items: { work_fee: number }[]): number {
  return items.reduce((acc, i) => acc + i.work_fee, 0);
}

export function formatYen(n: number): string {
  return "¥" + n.toLocaleString("ja-JP");
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

// 物販コード（P-0001…）の採番。DBに列を持てないため「物販」シートのA列が正本。
// 既存行の最大番号+1を返す（欠番があっても重複しないよう max+1）。
// rows は「物販」タブの全行（[0]はヘッダ想定。A列=物販コード）。
export function nextProductCode(rows: string[][]): string {
  let max = 0;
  for (const r of rows) {
    const m = (r?.[0] ?? "").trim().match(/^P-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  const next = max + 1;
  return `P-${String(next).padStart(4, "0")}`;
}

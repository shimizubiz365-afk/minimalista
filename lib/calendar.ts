// カレンダー描画用の純粋ロジック。visit_at は保存文字列の先頭10文字(YYYY-MM-DD)で
// 日付バケットを作る（ホームの today 判定と同じ規則＝タイムゾーンずれを起こさない）。

export type GridCell = { day: number; key: string } | null;

export function ymKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// 指定年月(month=1-12)の月カレンダーを、日曜始まりの週単位セル配列で返す。
export function monthGrid(year: number, month: number): GridCell[] {
  const offset = new Date(year, month - 1, 1).getDay(); // 0=日
  const days = new Date(year, month, 0).getDate(); // 月末日
  const cells: GridCell[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= days; d++) {
    cells.push({
      day: d,
      key: `${ymKey(year, month)}-${String(d).padStart(2, "0")}`,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// visit_at を持つ案件を YYYY-MM-DD でグルーピング（null は除外、入力順を保持）。
export function groupVisitsByDay<T extends { visit_at: string | null }>(
  cases: T[]
): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const c of cases) {
    if (!c.visit_at) continue;
    const key = c.visit_at.slice(0, 10);
    if (!key) continue;
    const arr = m.get(key);
    if (arr) arr.push(c);
    else m.set(key, [c]);
  }
  return m;
}

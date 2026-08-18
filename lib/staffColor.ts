// 担当者の色をスタッフIDから決定的に割り当てる（DBに色列を持てないため）。
// 同じIDは常に同じ色。未割り当て(空)はニュートラルなグレー。
export const STAFF_PALETTE = [
  "#2563eb", // blue
  "#16a34a", // green
  "#db2777", // pink
  "#ea580c", // orange
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#ca8a04", // amber
  "#dc2626", // red
];

const NEUTRAL = "#94a3b8"; // slate-400

export function staffColor(staffId: string | null | undefined): string {
  if (!staffId) return NEUTRAL;
  let h = 0;
  for (let i = 0; i < staffId.length; i++) {
    h = (h * 31 + staffId.charCodeAt(i)) >>> 0;
  }
  return STAFF_PALETTE[h % STAFF_PALETTE.length];
}

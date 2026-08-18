// 住所はDBが単一カラム(customers.address)。UIでは「郵便番号」と「住所」に分けて扱い、
// 保存時に `〒XXX-XXXX 住所` の形へ合成、読込時に分割する。

// 7桁数字をXXX-XXXXに正規化。7桁でなければ空。
export function normalizeZip(input: string): string {
  const d = (input ?? "").replace(/\D/g, "");
  if (d.length !== 7) return "";
  return `${d.slice(0, 3)}-${d.slice(3)}`;
}

// 保存済み住所文字列を { zip, rest } に分割。先頭の〒＋7桁を郵便番号、残りを住所とみなす。
export function splitAddress(stored: string | null | undefined): {
  zip: string;
  rest: string;
} {
  const s = (stored ?? "").trim();
  if (!s) return { zip: "", rest: "" };
  const m = s.match(/^〒?\s*(\d{3})-?(\d{4})\s*(.*)$/);
  if (m) return { zip: `${m[1]}-${m[2]}`, rest: m[3].trim() };
  return { zip: "", rest: s };
}

// 郵便番号と住所を1つの保存文字列へ合成。
export function combineAddress(zip: string, rest: string): string {
  const z = normalizeZip(zip);
  const r = (rest ?? "").trim();
  if (z && r) return `〒${z} ${r}`;
  if (z) return `〒${z}`;
  return r;
}

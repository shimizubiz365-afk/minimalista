// DB内部値（英語）→ 画面表示（日本語）の変換。表示専用。値そのものは英語のまま保存する。

export const CASE_STATUS_LABELS: Record<string, string> = {
  reserved: "予約",
  visiting: "訪問中",
  visited: "訪問完了",
  pending_pickup: "回収待ち",
  closed: "完了（クローズ）",
  cancelled: "キャンセル",
};

export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  in_stock: "在庫",
  listed: "出品中",
  sold: "売却済",
};

export const FEE_STATUS_LABELS: Record<string, string> = {
  accrued: "未払い",
  paid: "支払済",
};

export const SOURCE_LABELS: Record<string, string> = {
  phone: "電話",
  line: "LINE",
  referral: "紹介",
  other: "その他",
};

export const CHANNEL_LABELS: Record<string, string> = {
  mercari: "メルカリ",
  ebay: "eBay",
  yahoo: "ヤフオク",
  store: "店頭",
  other: "その他",
};

// 未知の値はそのまま返す（安全側）
export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "-";
  return map[value] ?? value;
}

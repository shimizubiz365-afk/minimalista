// DB内部値（英語）→ 画面表示（日本語）の変換。表示専用。値そのものは英語のまま保存する。

// 画面に出す案件ステータス。visiting は選択肢から外したが、既存行の表示のため残す。
export const CASE_STATUS_LABELS: Record<string, string> = {
  reserved: "確定",
  visited: "訪問完了",
  pending_pickup: "回収待ち",
  revisit: "再訪問",
  closed: "完了",
  cancelled: "キャンセル",
  visiting: "訪問中",
};

// 案件詳細のセレクトと一覧タブに出す順序（= 現場の進み順）
export const CASE_STATUS_FLOW = [
  "reserved",
  "visited",
  "pending_pickup",
  "revisit",
  "closed",
  "cancelled",
] as const;

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

// Google スプレッドシート連携（GENBA 管理表）
// drive.file スコープ + OAuth refresh_token。アプリが作成・所有するシートに読み書きする。
// 認証は gdrive.ts の accessToken を共用。
import { accessToken } from "./gdrive";
import { nextProductCode } from "./productCode";

// シート連携が使えるか（認証 + 対象シートID）
export function sheetsEnabled(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GENBA_SHEET_ID
  );
}

type Cell = string | number;

// 指定タブの末尾に1行追加
async function appendRow(tab: string, row: Cell[]): Promise<void> {
  const token = await accessToken();
  const sid = process.env.GENBA_SHEET_ID!;
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/` +
    `${encodeURIComponent(tab)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [row] }),
  });
  if (!res.ok) {
    throw new Error("Sheets追記に失敗: " + (await res.text()));
  }
}

// 売上タブの1行。列順は「GENBA 管理表」の売上ヘッダと一致させること。
// 精算日 / 案件ID / 顧客番号 / 顧客名 / 電話 / 買取額 / 回収費 / 差引 / 受領現金 / 紹介フィー / 担当者 / ステータス
export type SalesRow = {
  date: string;
  caseId: string;
  customerNo: string;
  customerName: string;
  phone: string;
  buyTotal: number;
  workTotal: number;
  net: number;
  cashSettled: number;
  referralFee: number | null;
  staffName: string;
  status: string;
};

export async function appendSalesRow(r: SalesRow): Promise<void> {
  await appendRow("売上", [
    r.date,
    r.caseId,
    r.customerNo,
    r.customerName,
    r.phone,
    r.buyTotal,
    r.workTotal,
    r.net,
    r.cashSettled,
    r.referralFee ?? "",
    r.staffName,
    r.status,
  ]);
}

// 予約リードタブの1行（中継エンドポイントから自動追記）。
// 列順: A流入元 B紹介元コード C氏名 D電話 E郵便番号 F住所 G状態 H取込済 I顧客番号
//        J相談内容 K希望時間帯 L紹介者名 M受信日時
export type LeadRow = {
  source: string; // 流入元（"LINE" 等）
  refCode?: string; // 紹介元コード（TK/アンバ。自動受付では空）
  name: string;
  phone?: string;
  zip?: string;
  address?: string;
  inquiry?: string; // 相談内容
  callTime?: string; // 希望時間帯
  referrer?: string; // 紹介者名（自由記述）
  receivedAt?: string; // 受信日時
};

export async function appendLeadRow(r: LeadRow): Promise<void> {
  await appendRow("予約リード", [
    r.source,
    r.refCode ?? "",
    r.name,
    r.phone ?? "",
    r.zip ?? "",
    r.address ?? "",
    "新規", // G状態
    "", // H取込済（未取込）
    "", // I顧客番号
    r.inquiry ?? "",
    r.callTime ?? "",
    r.referrer ?? "",
    r.receivedAt ?? "",
  ]);
}

// 物販タブの1行（商品が売れたタイミングで追記）。
// 列順: 物販コード / 商品名 / 仕入れ顧客番号 / 顧客名 / 担当者 / 原価 / 売値 / 利益 / 出品先 / 売却日 / 案件ID
export type ProductSaleRow = {
  productName: string;
  acquiredCustomerNo: string;
  customerName: string;
  staffName: string; // 担当者（買い取った営業）
  cost: number;
  salePrice: number;
  profit: number;
  channelLabel: string; // 出品先（日本語表示）
  soldAt: string;
  caseId: string;
};

// 物販コードはシートのA列が正本。既存の最大+1を採番して追記し、採番したコードを返す。
export async function appendProductSaleRow(r: ProductSaleRow): Promise<string> {
  const rows = await readSheet("物販");
  const code = nextProductCode(rows);
  await appendRow("物販", [
    code,
    r.productName,
    r.acquiredCustomerNo,
    r.customerName,
    r.staffName,
    r.cost,
    r.salePrice,
    r.profit,
    r.channelLabel,
    r.soldAt,
    r.caseId,
  ]);
  return code;
}

// 指定タブの全行を読む（[0]はヘッダ行）
export async function readSheet(tab: string): Promise<string[][]> {
  const token = await accessToken();
  const sid = process.env.GENBA_SHEET_ID!;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${encodeURIComponent(tab)}`,
    { headers: { Authorization: "Bearer " + token } }
  );
  if (!res.ok) throw new Error("Sheets読取に失敗: " + (await res.text()));
  const j = await res.json();
  return (j.values ?? []) as string[][];
}

// 指定範囲（例 "予約リード!H2:I2"）のセルを更新
export async function updateCells(rangeA1: string, values: Cell[][]): Promise<void> {
  const token = await accessToken();
  const sid = process.env.GENBA_SHEET_ID!;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/` +
      `${encodeURIComponent(rangeA1)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );
  if (!res.ok) throw new Error("Sheets更新に失敗: " + (await res.text()));
}

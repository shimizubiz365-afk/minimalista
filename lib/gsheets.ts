// Google スプレッドシート連携（GENBA 管理表）
// drive.file スコープ + OAuth refresh_token。アプリが作成・所有するシートに読み書きする。
// 認証は gdrive.ts の accessToken を共用。
import { accessToken } from "./gdrive";

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
// 精算日 / 案件ID / 顧客番号 / 顧客名 / 電話 / 買取額 / 回収費 / 差引 / 受領現金 / 紹介フィー / ステータス
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
    r.status,
  ]);
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

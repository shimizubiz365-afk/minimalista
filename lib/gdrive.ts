// Google Drive 連携 (会社Gmailの drive.file スコープ・OAuth refresh_token 方式)
// 画像は Drive を正本とする。顧客ごとにフォルダを作り、その中に保存する。

let cachedToken: { token: string; exp: number } | null = null;

export async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 30_000) return cachedToken.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!json.access_token) {
    throw new Error("Google Drive 認証に失敗しました: " + JSON.stringify(json));
  }
  cachedToken = {
    token: json.access_token,
    exp: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

export function driveEnabled(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GDRIVE_PARENT_FOLDER_ID
  );
}

function escapeQ(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// 親フォルダ直下で name 一致のフォルダを探す。なければ作る。
export async function findOrCreateFolder(
  name: string,
  parentId = process.env.GDRIVE_PARENT_FOLDER_ID!
): Promise<string> {
  // 安全装置: 親IDが無いと My Drive 直下に散らばるので必ず止める
  if (!parentId) throw new Error("GDRIVE_PARENT_FOLDER_ID が未設定です");
  const token = await accessToken();
  const q = `name='${escapeQ(name)}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const sr = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: "Bearer " + token } }
  );
  const sj = await sr.json();
  if (sj.files && sj.files.length > 0) return sj.files[0].id as string;

  const cr = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  const cj = await cr.json();
  if (!cj.id) throw new Error("フォルダ作成失敗: " + JSON.stringify(cj));
  return cj.id as string;
}

// 顧客フォルダ名 = "顧客番号 氏名"（番号がユニークなので衝突しない）
export function customerFolderName(customerNo: string, name: string): string {
  return `${customerNo} ${name}`.trim();
}

export type DriveUpload = { id: string; webViewLink: string };

export async function uploadFile(
  folderId: string,
  filename: string,
  mimeType: string,
  data: Buffer
): Promise<DriveUpload> {
  const token = await accessToken();
  const boundary = "genbabnd" + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name: filename, parents: [folderId] });
  const pre = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    "utf8"
  );
  const post = Buffer.from(`\r\n--${boundary}--`, "utf8");
  const body = Buffer.concat([pre, data, post]);
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  const json = await res.json();
  if (!json.id) throw new Error("Driveアップロード失敗: " + JSON.stringify(json));
  return { id: json.id as string, webViewLink: json.webViewLink as string };
}

import { NextResponse } from "next/server";

// Google が認可後にリダイレクトしてくる。code を refresh_token に交換して画面表示する。
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) return html(`認可エラー: ${error}`);
  if (!code) return html("code がありません");

  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI!,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok || !json.refresh_token) {
    return html(
      `トークン交換に失敗しました。<br>${JSON.stringify(json)}<br><br>※ refresh_token が出ない場合は、Google アカウント設定でこのアプリのアクセスを一度解除してから、再度やり直してください。`
    );
  }
  return html(
    `連携成功！ 下の <b>リフレッシュトークン</b> をコピーして管理者（Claude）に貼り付けてください。<br><br>` +
      `<code style="word-break:break-all;display:block;background:#f3f3f3;padding:12px;border-radius:6px;user-select:all">${json.refresh_token}</code>`
  );
}

function html(message: string) {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;max-width:480px;margin:40px auto;padding:0 16px;line-height:1.7"><h2>MINIMALISTA × Google Drive 連携</h2><p>${message}</p></body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

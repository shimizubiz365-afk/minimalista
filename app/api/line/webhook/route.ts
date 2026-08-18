import { verifyLineSignature } from "@/lib/lineSignature";
import { parseLeadTemplate } from "@/lib/lineTemplate";
import { appendLeadRow, sheetsEnabled } from "@/lib/gsheets";

// 顧客向けLINEの Webhook 中継。
// LINEチャネルのWebhookはここに向け、(1)受付テンプレを予約リードへ自動追記し、
// (2)本文をそのままエルメ(L Message)へ転送して既存の自動応答を一切壊さない。
// チャネルは1つしかWebhookを持てないため、エルメの前段に立つ「中継(プロキシ)」構成。
export const runtime = "nodejs";

function jst(ms?: number): string {
  const d = ms ? new Date(ms) : new Date();
  // "2026-06-27 15:07"（JST）
  const s = d.toLocaleString("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return s.replace("T", " ");
}

// エルメ(既存Webhook)へ本文を素通しで転送。署名ヘッダもそのまま渡してエルメ側検証を通す。
async function forwardToElme(rawBody: string, signature: string): Promise<void> {
  const url = process.env.ELME_FORWARD_URL;
  if (!url) return; // 未設定なら転送しない（テスト中など）
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Line-Signature": signature,
    },
    body: rawBody,
  });
  if (!res.ok) {
    console.error("[line/webhook] エルメ転送に失敗:", res.status, await res.text().catch(() => ""));
  }
}

type LineEvent = {
  type?: string;
  timestamp?: number;
  message?: { type?: string; text?: string };
};

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";
  const secret = process.env.LINE_CHANNEL_SECRET;

  // シークレットが設定済なら署名検証（偽リード注入を防ぐ）。未設定なら検証スキップ。
  if (secret && !verifyLineSignature(rawBody, signature, secret)) {
    return new Response("invalid signature", { status: 403 });
  }

  const tasks: Promise<unknown>[] = [];

  // (2) まずエルメ転送を仕込む（最優先＝既存フローを壊さない）。
  tasks.push(forwardToElme(rawBody, signature).catch((e) => console.error("[line/webhook] forward error:", e)));

  // (1) 受付テンプレを予約リードへ追記。
  try {
    const body = rawBody ? JSON.parse(rawBody) : {};
    const events: LineEvent[] = Array.isArray(body.events) ? body.events : [];
    for (const ev of events) {
      if (ev.type !== "message" || ev.message?.type !== "text") continue;
      const lead = parseLeadTemplate(ev.message.text ?? "");
      if (!lead) continue;
      if (!sheetsEnabled()) {
        console.error("[line/webhook] sheets未設定のためリード追記スキップ");
        continue;
      }
      tasks.push(
        appendLeadRow({
          source: "LINE",
          name: lead.name ?? "（氏名未入力）",
          phone: lead.phone,
          zip: lead.zip,
          inquiry: lead.inquiry,
          callTime: lead.callTime,
          referrer: lead.referrer,
          receivedAt: jst(ev.timestamp),
        }).catch((e) => console.error("[line/webhook] リード追記エラー:", e))
      );
    }
  } catch (e) {
    console.error("[line/webhook] 本文パースエラー:", e);
  }

  await Promise.allSettled(tasks);
  // LINEには常に200を返す（リトライ嵐を避ける）。
  return new Response("OK", { status: 200 });
}

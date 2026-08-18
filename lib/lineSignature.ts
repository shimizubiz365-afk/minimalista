import crypto from "node:crypto";

// LINE Messaging API の Webhook 署名検証。
// X-Line-Signature = HMAC-SHA256(channelSecret, rawBody) を base64 した値。
// タイミング安全に比較する。
export function verifyLineSignature(
  rawBody: string,
  signature: string,
  channelSecret: string
): boolean {
  if (!signature || !channelSecret) return false;
  const expected = crypto
    .createHmac("sha256", channelSecret)
    .update(rawBody, "utf8")
    .digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

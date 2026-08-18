import { ok, fail, requireStaff } from "@/lib/api";

// 郵便番号→住所（都道府県・市区町村・町域）の検索。
// zipcloud(無料・キー不要)をサーバー側で叩いてCORSを回避する。
export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const code = (new URL(req.url).searchParams.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 7) return fail("郵便番号は7桁で指定してください", 400);

  let j: { results?: { address1: string; address2: string; address3: string }[] | null };
  try {
    const r = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${code}`, {
      // 念のためタイムアウト相当（外部API）
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return fail("郵便番号検索に失敗しました", 502);
    j = await r.json();
  } catch {
    return fail("郵便番号検索に失敗しました", 502);
  }

  const res = j.results?.[0];
  if (!res) return ok({ found: false });
  return ok({
    found: true,
    prefecture: res.address1,
    city: res.address2,
    town: res.address3,
    address: `${res.address1}${res.address2}${res.address3}`,
  });
}

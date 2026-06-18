import { staffFromIdToken } from "@/lib/liffAuth";

export function ok<T>(data: T): Response {
  return Response.json({ ok: true, data });
}

export function fail(error: string, status = 400): Response {
  return Response.json({ ok: false, error }, { status });
}

export async function requireStaff(
  req: Request
): Promise<{ staff: { id: string; name: string } } | Response> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return fail("認証トークンがありません", 401);
  const staff = await staffFromIdToken(token);
  if (!staff) return fail("スタッフ登録が確認できません。管理者に連絡してください", 401);
  return { staff };
}

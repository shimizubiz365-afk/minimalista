import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function verifyIdToken(
  idToken: string
): Promise<{ lineUserId: string } | null> {
  try {
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: process.env.LINE_LOGIN_CHANNEL_ID!,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.sub) return null;
    return { lineUserId: json.sub as string };
  } catch {
    return null;
  }
}

export async function staffFromIdToken(
  idToken: string
): Promise<{ id: string; name: string } | null> {
  const verified = await verifyIdToken(idToken);
  if (!verified) return null;
  const { data } = await supabaseAdmin()
    .from("staff")
    .select("id, name")
    .eq("line_user_id", verified.lineUserId)
    .eq("active", true)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id as string, name: data.name as string };
}

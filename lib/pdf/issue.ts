import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function storePdf(
  caseId: string,
  type: "purchase_slip" | "receipt",
  buf: Buffer
): Promise<{ document_id: string; signed_url: string }> {
  const db = supabaseAdmin();
  const path = `${caseId}/${type}-${crypto.randomUUID()}.pdf`;
  const up = await db.storage
    .from("documents")
    .upload(path, buf, { contentType: "application/pdf" });
  if (up.error) throw new Error(up.error.message);
  const { data: doc, error } = await db
    .from("documents")
    .insert({ case_id: caseId, type, storage_path: path })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const signed = await db.storage.from("documents").createSignedUrl(path, 60 * 30);
  if (signed.error) throw new Error(signed.error.message);
  return { document_id: doc.id, signed_url: signed.data.signedUrl };
}

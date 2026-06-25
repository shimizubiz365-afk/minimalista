import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  driveEnabled,
  findOrCreateFolder,
  customerFolderName,
  uploadFile,
} from "@/lib/gdrive";

const PDF_LABEL: Record<string, string> = {
  purchase_slip: "買取伝票",
  receipt: "領収書",
};

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

  // 顧客の Drive フォルダにも控えを保存（失敗してもPDF発行は止めない）
  if (driveEnabled()) {
    try {
      const { data: c } = await db
        .from("cases")
        .select("customer:customers(customer_no,name)")
        .eq("id", caseId)
        .maybeSingle();
      const cust = (c as { customer?: { customer_no: string; name: string } } | null)
        ?.customer;
      if (cust) {
        const folderId = await findOrCreateFolder(
          customerFolderName(cust.customer_no, cust.name)
        );
        const stamp = new Date().toISOString().slice(0, 10);
        await uploadFile(
          folderId,
          `${PDF_LABEL[type] ?? type}_${stamp}.pdf`,
          "application/pdf",
          buf
        );
      }
    } catch {
      // Drive控えは任意。エラーは無視。
    }
  }

  return { document_id: doc.id, signed_url: signed.data.signedUrl };
}

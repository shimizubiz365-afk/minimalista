import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  driveEnabled,
  findOrCreateFolder,
  customerFolderName,
  uploadFile,
} from "@/lib/gdrive";

const KIND_LABEL: Record<string, string> = {
  purchase: "買取",
  collection: "回収",
  id_doc: "本人確認",
};

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const form = await req.formData();
  const file = form.get("file");
  const caseId = form.get("case_id")?.toString();
  const kind = form.get("kind")?.toString();
  if (!(file instanceof File) || !caseId || !kind)
    return fail("file / case_id / kind は必須", 400);

  const db = supabaseAdmin();
  const ext = file.name.split(".").pop() ?? "jpg";
  const buf = Buffer.from(await file.arrayBuffer());

  let storagePath: string;

  if (driveEnabled()) {
    // Drive を正本に。顧客フォルダを引いて（無ければ作って）そこへ保存。
    const { data: c } = await db
      .from("cases")
      .select("customer:customers(customer_no,name)")
      .eq("id", caseId)
      .maybeSingle();
    const cust = (c as { customer?: { customer_no: string; name: string } } | null)
      ?.customer;
    const folderName = cust
      ? customerFolderName(cust.customer_no, cust.name)
      : `case_${caseId}`;
    try {
      const folderId = await findOrCreateFolder(folderName);
      const label = KIND_LABEL[kind] ?? kind;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
      const filename = `${label}_${stamp}.${ext}`;
      const upl = await uploadFile(folderId, filename, file.type || "image/jpeg", buf);
      storagePath = upl.webViewLink; // 後から開けるよう Drive の閲覧リンクを保存
    } catch (e) {
      return fail("Drive保存に失敗: " + (e as Error).message, 500);
    }
  } else {
    // フォールバック: Supabase Storage
    const objId = crypto.randomUUID();
    storagePath = `${caseId}/${objId}.${ext}`;
    const up = await db.storage
      .from("media")
      .upload(storagePath, buf, { contentType: file.type });
    if (up.error) return fail(up.error.message, 500);
  }

  // NOTE: 本番 media テーブルは purchase_item_id/collection_item_id 列が未追加
  // (migration 0001 の初回適用版のまま)。Drive が正本なので item 紐付けは省略。
  const { data, error } = await db
    .from("media")
    .insert({
      case_id: caseId,
      kind,
      storage_path: storagePath,
    })
    .select("id, storage_path")
    .single();
  if (error) return fail(error.message, 500);
  return ok({ id: data.id, storage_path: data.storage_path });
}

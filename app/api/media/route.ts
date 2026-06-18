import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
  const objId = crypto.randomUUID();
  const storagePath = `${caseId}/${objId}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const up = await db.storage
    .from("media")
    .upload(storagePath, buf, { contentType: file.type });
  if (up.error) return fail(up.error.message, 500);

  const { data, error } = await db
    .from("media")
    .insert({
      case_id: caseId,
      kind,
      purchase_item_id: form.get("purchase_item_id")?.toString() || null,
      collection_item_id: form.get("collection_item_id")?.toString() || null,
      storage_path: storagePath,
    })
    .select("id, storage_path")
    .single();
  if (error) return fail(error.message, 500);
  return ok({ id: data.id, storage_path: data.storage_path });
}

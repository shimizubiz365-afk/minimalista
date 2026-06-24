"use client";
import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

const METHODS = ["運転免許証", "マイナンバーカード", "在留カード", "パスポート", "その他"];

export default function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [method, setMethod] = useState(METHODS[0]);
  const [occupation, setOccupation] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string>();

  async function save() {
    const by = parseInt(birthYear, 10);
    if (!occupation || isNaN(by)) {
      setMsg("職業と生年（西暦）は必須");
      return;
    }
    setMsg("保存中...");
    let idMediaId: string | undefined;
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("case_id", id);
      fd.append("kind", "id_doc");
      const m = await apiFetch<{ id: string }>("/api/media", { method: "POST", body: fd });
      if (!m.ok) {
        setMsg("身分証写真の保存に失敗: " + m.error);
        return;
      }
      idMediaId = m.data!.id;
    }
    const r = await apiFetch(`/api/cases/${id}/verify`, {
      method: "POST",
      body: JSON.stringify({
        verification_method: method,
        occupation,
        birth_year: by,
        id_media_id: idMediaId,
      }),
    });
    if (r.ok) router.push(`/cases/${id}`);
    else setMsg(r.error);
  }

  return (
    <main>
      <AppHeader title="本人確認" backHref={`/cases/${id}`} />
      <section className="px-5 pt-6 space-y-4">
        <Field label="確認方法">
          <select
            className={inputClass}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="職業" required>
          <input
            className={inputClass}
            placeholder="職業"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
          />
        </Field>
        <Field label="生年（西暦）" required>
          <input
            className={inputClass}
            type="number"
            inputMode="numeric"
            placeholder="生年（西暦 例:1985）"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
          />
        </Field>
        <Field label="身分証の写真">
          <label className="w-full border border-border rounded-md px-3 h-12 bg-surface text-muted flex items-center gap-2 cursor-pointer active:bg-border/40">
            <Camera className="w-4 h-4" />
            <span className="text-sm truncate">
              {file ? file.name : "写真を撮影 / 選択"}
            </span>
            <input
              className="hidden"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </Field>
        {msg && <p className="text-danger text-sm">{msg}</p>}
        <Button onClick={save} size="lg">
          本人確認を保存
        </Button>
      </section>
    </main>
  );
}

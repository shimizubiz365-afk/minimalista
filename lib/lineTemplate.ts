// LINE受付テンプレ（応答メッセージで顧客に入力させる【】形式）のパーサー。
// 顧客向けLINE → 中継エンドポイント /api/line/webhook で使い、予約リードシートへ流す。
// テンプレ例:
//   【お名前】 【電話番号】 【郵便番号】 【ご紹介者】※分かる範囲で
//   【ご相談内容】※手放したいもの・お困りごと 【お電話可能な時間帯】例:平日18時以降

export type LeadFields = {
  name?: string;
  phone?: string;
  zip?: string;
  referrer?: string;
  inquiry?: string;
  callTime?: string;
};

type Field = keyof LeadFields;

// ラベル→項目。表記ゆれを吸収。優先順位順（電話が時間帯ラベルに誤マッチしないよう callTime を phone より前に）。
const LABELS: { field: Field; aliases: string[] }[] = [
  { field: "callTime", aliases: ["時間帯", "連絡可能", "都合", "ご連絡"] },
  { field: "zip", aliases: ["郵便番号", "郵便", "〒"] },
  { field: "referrer", aliases: ["紹介"] },
  { field: "inquiry", aliases: ["相談", "内容", "ご用件", "用件"] },
  { field: "name", aliases: ["お名前", "氏名", "名前"] },
  { field: "phone", aliases: ["電話", "tel", "ＴＥＬ", "携帯"] },
];

function labelToField(label: string): Field | null {
  const l = label.toLowerCase().replace(/\s/g, "");
  for (const { field, aliases } of LABELS) {
    if (aliases.some((a) => l.includes(a.toLowerCase()))) return field;
  }
  return null;
}

// 自動応答フッターの境界線（━━━ / ─── / === 等が並ぶ行）。これ以降は定型文なので切り捨てる。
const SEPARATOR_LINE = /^[ \t]*[-=_~ー―‐–—─━═＝]{3,}[ \t]*$/;

// 区切り線が出たらそこで本文を打ち切る（フッター混入を防ぐ）。
function stripFooter(text: string): string {
  const lines = text.split(/\r?\n/);
  const i = lines.findIndex((l) => SEPARATOR_LINE.test(l));
  return i >= 0 ? lines.slice(0, i).join("\n") : text;
}

// ※注記 と 例:ヒント を除去し、行単位でトリムして1値に。空なら undefined。
// 行内のスペース（氏名の全角スペース等）は保持する。
function cleanValue(raw: string): string | undefined {
  const cleaned = raw.replace(/※[^\n]*/g, "").replace(/例[:：][^\n]*/g, "");
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.join(" ") || undefined;
}

function normPhone(raw: string): string | undefined {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  const kept = raw.replace(/[^\d-]/g, "").trim();
  return kept || undefined;
}

function normZip(raw: string): string | undefined {
  const d = raw.replace(/\D/g, "");
  if (d.length === 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  const kept = raw.replace(/[^\d-]/g, "").trim();
  return kept || undefined;
}

export function parseLeadTemplate(input: string): LeadFields | null {
  if (!input) return null;
  const text = stripFooter(input);

  // 【ラベル】 の位置を全部拾い、各ラベルの値＝次の【までの本文。
  const matches = [...text.matchAll(/【([^】]+)】/g)];
  if (matches.length === 0) return null;

  const out: LeadFields = {};
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const field = labelToField(m[1]);
    if (!field) continue;
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const value = cleanValue(text.slice(start, end));
    if (!value) continue;
    if (field === "phone") out.phone = normPhone(value);
    else if (field === "zip") out.zip = normZip(value);
    else if (!out[field]) out[field] = value;
  }

  // 氏名も電話も無ければリードと見なさない（誤検知防止）。
  if (!out.name && !out.phone) return null;
  return out;
}

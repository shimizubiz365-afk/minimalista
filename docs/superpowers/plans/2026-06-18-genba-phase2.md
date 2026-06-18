# GENBA Phase 2 Implementation Plan — 本人確認・古物台帳・精算

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 買取案件を本人確認→精算確定→古物台帳自動生成→クローズまで法的・会計的に確定できるようにする。

**Architecture:** Phase 1 の Next.js + Supabase + LIFF 基盤に積む。新テーブル settlements / kobutsu_daicho、cases/customers への列追加、本人確認画面、精算API（settlements作成＋台帳一括生成＋case close）。

**Tech Stack:** Phase 1 と同一（Next.js 16, TS, Supabase, @react-pdf 不使用本フェーズ, Vitest）。

## Global Constraints
- 金額は integer（円）、計算は決定論・テスト必須。
- 全DBアクセスは API route 経由・`{ok,data?,error?}` 形式・`requireStaff` ガード。
- 古物台帳は全件記録（1万円未満免除/例外品目は実装しない）。
- 台帳の顧客情報は取引時点スナップショット（後の顧客変更に追従しない）。
- 法定5項目：取引年月日/品目・数量/特徴/相手方の住所・氏名・職業・年齢/確認方法。

---

### Task 1: マイグレーション0003（列追加 + settlements + kobutsu_daicho）

**Files:**
- Create: `supabase/migrations/0003_phase2_schema.sql`

- [ ] **Step 1: SQL を作成**

`supabase/migrations/0003_phase2_schema.sql`:
```sql
-- customers: 法定項目（職業・生年）
alter table customers add column occupation text;
alter table customers add column birth_year integer;

-- cases: 本人確認情報（その取引固有）
alter table cases add column verification_method text;
alter table cases add column id_media_id uuid references media(id);

-- settlements（精算）
create table settlements (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references cases(id),
  buy_total integer not null,
  work_total integer not null,
  net_amount integer not null,
  cash_settled integer not null,
  settled_at timestamptz not null default now(),
  settled_by uuid references staff(id)
);

-- kobutsu_daicho（古物台帳・法定）
create table kobutsu_daicho (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  purchase_item_id uuid not null references purchase_items(id),
  transaction_date date not null,
  item_description text not null,
  quantity integer not null default 1,
  item_characteristics text,
  price integer not null,
  customer_name text not null,
  customer_address text not null,
  customer_occupation text not null,
  customer_age integer not null,
  verification_method text not null,
  id_media_id uuid references media(id),
  created_at timestamptz not null default now()
);
create index idx_kobutsu_case on kobutsu_daicho(case_id);
create index idx_kobutsu_txdate on kobutsu_daicho(transaction_date);
```

- [ ] **Step 2: Supabase に適用**（SQLエディタ or MCP）。Expected: 2テーブル新規 + 4列追加。
- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/0003_phase2_schema.sql
git commit -m "feat: Phase 2 schema (settlements, kobutsu_daicho, customer/case columns)"
```

---

### Task 2: netAmount 決定論ロジック（TDD）

**Files:**
- Modify: `lib/money.ts`
- Modify: `lib/money.test.ts`

**Interfaces:**
- Produces: `lib/money.ts`: `export function netAmount(buyTotal: number, workTotal: number): number`

- [ ] **Step 1: 失敗するテストを追記**

`lib/money.test.ts` に追記:
```ts
import { netAmount } from "@/lib/money";

describe("netAmount", () => {
  it("買取超過は正", () => expect(netAmount(10000, 3000)).toBe(7000));
  it("受領超過は負", () => expect(netAmount(2000, 5000)).toBe(-3000));
  it("同額は0", () => expect(netAmount(4000, 4000)).toBe(0));
});
```
※ ファイル冒頭の import 行に `netAmount` を追加（`import { sumAmounts, sumWorkFees, formatYen, netAmount } from "@/lib/money";`）。重複 import を作らないこと。

- [ ] **Step 2: 実行して失敗確認** — Run: `npm run test -- lib/money.test.ts` → FAIL
- [ ] **Step 3: 実装を追記**

`lib/money.ts` に追記:
```ts
export function netAmount(buyTotal: number, workTotal: number): number {
  return buyTotal - workTotal;
}
```

- [ ] **Step 4: 実行して通過** — Run: `npm run test -- lib/money.test.ts` → PASS（11件）
- [ ] **Step 5: Commit**
```bash
git add lib/money.ts lib/money.test.ts
git commit -m "feat: netAmount deterministic helper (TDD)"
```

---

### Task 3: 本人確認 API（cases verification + customers 職業/生年）

**Files:**
- Create: `app/api/cases/[id]/verify/route.ts`

**Interfaces:**
- Consumes: `ok`/`fail`/`requireStaff`, `supabaseAdmin`
- Produces: `POST /api/cases/[id]/verify` body `{ verification_method, occupation, birth_year, id_media_id }` → `data: { ok: true }`

- [ ] **Step 1: 実装**

`app/api/cases/[id]/verify/route.ts`:
```ts
import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const b = await req.json();
  if (!b.verification_method || !b.occupation || typeof b.birth_year !== "number")
    return fail("確認方法・職業・生年は必須", 400);

  const db = supabaseAdmin();
  // 案件 → 顧客id を取得
  const c = await db.from("cases").select("id, customer_id").eq("id", id).maybeSingle();
  if (c.error || !c.data) return fail("案件が見つかりません", 404);

  const upCust = await db
    .from("customers")
    .update({ occupation: b.occupation, birth_year: b.birth_year })
    .eq("id", c.data.customer_id);
  if (upCust.error) return fail(upCust.error.message, 500);

  const upCase = await db
    .from("cases")
    .update({ verification_method: b.verification_method, id_media_id: b.id_media_id ?? null })
    .eq("id", id);
  if (upCase.error) return fail(upCase.error.message, 500);

  return ok({ ok: true });
}
```

- [ ] **Step 2: ビルド確認** — Run: `npm run build` → 成功
- [ ] **Step 3: Commit**
```bash
git add app/api/cases/[id]/verify
git commit -m "feat: identity verification API (case verification + customer occupation/birth_year)"
```

---

### Task 4: 本人確認 画面

**Files:**
- Create: `app/cases/[id]/verify/page.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `POST /api/media`(kind=id_doc), `POST /api/cases/[id]/verify`

- [ ] **Step 1: 実装**

`app/cases/[id]/verify/page.tsx`:
```tsx
"use client";
import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/liffClient";

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
    <main className="p-4 space-y-3">
      <h1 className="text-lg font-bold">本人確認</h1>
      <label className="block text-sm">確認方法</label>
      <select className="border p-2 w-full" value={method} onChange={(e) => setMethod(e.target.value)}>
        {METHODS.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <input
        className="border p-2 w-full"
        placeholder="職業"
        value={occupation}
        onChange={(e) => setOccupation(e.target.value)}
      />
      <input
        className="border p-2 w-full"
        type="number"
        inputMode="numeric"
        placeholder="生年（西暦 例:1985）"
        value={birthYear}
        onChange={(e) => setBirthYear(e.target.value)}
      />
      <label className="block text-sm">身分証の写真</label>
      <input
        className="border p-2 w-full"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      {msg && <p className="text-red-600">{msg}</p>}
      <button onClick={save} className="bg-black text-white w-full py-3 rounded">
        本人確認を保存
      </button>
    </main>
  );
}
```

- [ ] **Step 2: ビルド確認** — Run: `npm run build` → 成功
- [ ] **Step 3: Commit**
```bash
git add app/cases/[id]/verify/page.tsx
git commit -m "feat: identity verification screen (id photo + occupation + birth year)"
```

---

### Task 5: 精算 API（settlements + 古物台帳生成 + close）

**Files:**
- Create: `lib/settlement.ts`
- Create: `app/api/settlements/route.ts`
- Test: `lib/settlement.test.ts`

**Interfaces:**
- Consumes: `ok`/`fail`/`requireStaff`, `supabaseAdmin`, `sumAmounts`/`sumWorkFees`/`netAmount`
- Produces:
  - `lib/settlement.ts`: `export function buildDaichoRows(input: { caseId: string; purchaseItems: {id:string; name:string; brand:string|null; model:string|null; condition:string|null; amount:number}[]; customer: {name:string; address:string|null; occupation:string|null; birth_year:number|null}; verificationMethod: string|null; idMediaId: string|null; txDate: string; currentYear: number }): DaichoRow[]`（純関数・台帳行を組み立てる。テスト対象）
  - `POST /api/settlements` body `{ case_id, cash_settled }` → `data: { buy_total, work_total, net_amount, cash_settled, daicho_count }`

- [ ] **Step 1: 失敗するテストを書く（台帳組み立ての純関数）**

`lib/settlement.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildDaichoRows } from "@/lib/settlement";

const base = {
  caseId: "case1",
  customer: { name: "山田太郎", address: "東京都X", occupation: "会社員", birth_year: 1985 },
  verificationMethod: "運転免許証",
  idMediaId: "media1",
  txDate: "2026-06-18",
  currentYear: 2026,
};

describe("buildDaichoRows", () => {
  it("買取明細1件→台帳1行・法定項目が埋まる", () => {
    const rows = buildDaichoRows({
      ...base,
      purchaseItems: [{ id: "p1", name: "腕時計", brand: "SEIKO", model: "ABC", condition: "美品", amount: 12000 }],
    });
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.purchase_item_id).toBe("p1");
    expect(r.case_id).toBe("case1");
    expect(r.item_description).toBe("腕時計 / SEIKO / ABC");
    expect(r.item_characteristics).toBe("美品");
    expect(r.price).toBe(12000);
    expect(r.customer_name).toBe("山田太郎");
    expect(r.customer_address).toBe("東京都X");
    expect(r.customer_occupation).toBe("会社員");
    expect(r.customer_age).toBe(41); // 2026 - 1985
    expect(r.verification_method).toBe("運転免許証");
    expect(r.id_media_id).toBe("media1");
    expect(r.quantity).toBe(1);
    expect(r.transaction_date).toBe("2026-06-18");
  });

  it("複数明細→件数一致", () => {
    const rows = buildDaichoRows({
      ...base,
      purchaseItems: [
        { id: "p1", name: "A", brand: null, model: null, condition: null, amount: 100 },
        { id: "p2", name: "B", brand: null, model: null, condition: null, amount: 200 },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].item_description).toBe("A");
    expect(rows[1].customer_age).toBe(41);
  });
});
```

- [ ] **Step 2: 実行して失敗確認** — Run: `npm run test -- lib/settlement.test.ts` → FAIL
- [ ] **Step 3: `lib/settlement.ts` を実装**

```ts
export type DaichoRow = {
  case_id: string;
  purchase_item_id: string;
  transaction_date: string;
  item_description: string;
  quantity: number;
  item_characteristics: string | null;
  price: number;
  customer_name: string;
  customer_address: string;
  customer_occupation: string;
  customer_age: number;
  verification_method: string;
  id_media_id: string | null;
};

export function buildDaichoRows(input: {
  caseId: string;
  purchaseItems: {
    id: string;
    name: string;
    brand: string | null;
    model: string | null;
    condition: string | null;
    amount: number;
  }[];
  customer: { name: string; address: string | null; occupation: string | null; birth_year: number | null };
  verificationMethod: string | null;
  idMediaId: string | null;
  txDate: string;
  currentYear: number;
}): DaichoRow[] {
  return input.purchaseItems.map((p) => ({
    case_id: input.caseId,
    purchase_item_id: p.id,
    transaction_date: input.txDate,
    item_description: [p.name, p.brand, p.model].filter(Boolean).join(" / "),
    quantity: 1,
    item_characteristics: p.condition ?? null,
    price: p.amount,
    customer_name: input.customer.name,
    customer_address: input.customer.address ?? "",
    customer_occupation: input.customer.occupation ?? "",
    customer_age: input.customer.birth_year ? input.currentYear - input.customer.birth_year : 0,
    verification_method: input.verificationMethod ?? "",
    id_media_id: input.idMediaId,
  }));
}
```

- [ ] **Step 4: 実行して通過** — Run: `npm run test -- lib/settlement.test.ts` → PASS
- [ ] **Step 5: 精算 API を実装**

`app/api/settlements/route.ts`:
```ts
import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sumAmounts, sumWorkFees, netAmount } from "@/lib/money";
import { buildDaichoRows } from "@/lib/settlement";

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { case_id, cash_settled } = await req.json();
  if (!case_id || typeof cash_settled !== "number")
    return fail("case_id / cash_settled は必須", 400);
  const db = supabaseAdmin();

  // 二重確定防止
  const existing = await db.from("settlements").select("id").eq("case_id", case_id).maybeSingle();
  if (existing.data) return fail("既に精算確定済みです", 409);

  // 案件 + 顧客 + 確認情報
  const c = await db
    .from("cases")
    .select(
      "id, verification_method, id_media_id, customer:customers(name,address,occupation,birth_year)"
    )
    .eq("id", case_id)
    .maybeSingle();
  if (c.error || !c.data) return fail("案件が見つかりません", 404);
  const cust = (c.data as unknown as {
    customer: { name: string; address: string | null; occupation: string | null; birth_year: number | null };
  }).customer;

  const pis = await db
    .from("purchase_items")
    .select("id,name,brand,model,condition,amount")
    .eq("case_id", case_id)
    .order("created_at");
  if (pis.error) return fail(pis.error.message, 500);
  const purchaseItems = pis.data ?? [];

  const cis = await db.from("collection_items").select("work_fee").eq("case_id", case_id);
  if (cis.error) return fail(cis.error.message, 500);

  // 買取があるなら本人確認必須
  if (purchaseItems.length > 0) {
    const cm = c.data as unknown as { verification_method: string | null };
    if (!cm.verification_method || !cust.occupation || !cust.birth_year) {
      return fail("本人確認が未完了です（確認方法・職業・生年・身分証）", 400);
    }
  }

  const buy_total = sumAmounts(purchaseItems);
  const work_total = sumWorkFees(cis.data ?? []);
  const net_amount = netAmount(buy_total, work_total);

  // settlements
  const st = await db
    .from("settlements")
    .insert({
      case_id,
      buy_total,
      work_total,
      net_amount,
      cash_settled,
      settled_by: guard.staff.id,
    })
    .select("id")
    .single();
  if (st.error) return fail(st.error.message, 500);

  // 古物台帳（買取明細がある場合のみ）
  let daicho_count = 0;
  if (purchaseItems.length > 0) {
    const cmeta = c.data as unknown as { verification_method: string | null; id_media_id: string | null };
    const txDate = new Date().toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear();
    const rows = buildDaichoRows({
      caseId: case_id,
      purchaseItems,
      customer: cust,
      verificationMethod: cmeta.verification_method,
      idMediaId: cmeta.id_media_id,
      txDate,
      currentYear,
    });
    const ins = await db.from("kobutsu_daicho").insert(rows);
    if (ins.error) return fail("台帳生成に失敗: " + ins.error.message, 500);
    daicho_count = rows.length;
  }

  // クローズ
  const cl = await db
    .from("cases")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", case_id);
  if (cl.error) return fail(cl.error.message, 500);

  return ok({ buy_total, work_total, net_amount, cash_settled, daicho_count });
}
```

- [ ] **Step 6: ビルド + テスト** — Run: `npm run build` → 成功 / `npm run test` → 全PASS
- [ ] **Step 7: Commit**
```bash
git add lib/settlement.ts lib/settlement.test.ts app/api/settlements
git commit -m "feat: settlement API (settlements + kobutsu_daicho generation + case close) + TDD"
```

---

### Task 6: 案件詳細に本人確認状態 + 精算確定UI

**Files:**
- Modify: `app/cases/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/cases/[id]`（verification_method を含める）, `POST /api/settlements`

- [ ] **Step 1: 詳細APIに verification 情報を載せる**

`app/api/cases/[id]/route.ts` の GET の `case` select は `*` なので `verification_method` は既に含まれる。`customer:customers(*)` も occupation/birth_year を含む。**変更不要**（確認のみ）。

- [ ] **Step 2: 詳細画面に本人確認バッジ＋verifyリンク＋精算確定を追加**

`app/cases/[id]/page.tsx` の `Detail` 型を拡張し、本人確認状態と精算ボタンを表示する。`Detail.case` に `verification_method: string | null` を追加。`Detail` に `settlement?: { net_amount: number } | null` は持たず、精算は status==='closed' で判定。

ステータス選択の下に以下を挿入：
```tsx
{/* 本人確認 */}
<section>
  <h2 className="font-bold">本人確認</h2>
  {d.case.verification_method ? (
    <p className="text-sm text-green-700">確認済み（{d.case.verification_method}）</p>
  ) : (
    <Link href={`/cases/${id}/verify`} className="text-blue-600">本人確認を実施</Link>
  )}
</section>
```
（型）`case` に `verification_method: string | null;` を追加。

精算確定セクション（回収/買取セクションの後）：
```tsx
<section className="border-t pt-3">
  <h2 className="font-bold">精算</h2>
  {d.case.status === "closed" ? (
    <p className="text-sm text-green-700">精算確定済み（クローズ）</p>
  ) : (
    <>
      <label className="text-sm">受領/支払 現金（円）</label>
      <input
        className="border p-2 w-full"
        type="number"
        inputMode="numeric"
        value={cash}
        onChange={(e) => setCash(e.target.value)}
        placeholder={`差引: ${formatYen(buyTotal - workTotal)}`}
      />
      <button onClick={settle} className="mt-2 bg-red-700 text-white w-full py-2 rounded">
        精算を確定する（台帳生成・クローズ）
      </button>
    </>
  )}
</section>
```

必要な state とハンドラ（コンポーネント内に追加）：
```tsx
const [cash, setCash] = useState("");
async function settle() {
  const n = parseInt(cash, 10);
  if (isNaN(n)) { setMsg("受領/支払現金を入力してください"); return; }
  setMsg("精算確定中...");
  const r = await apiFetch<{ daicho_count: number }>("/api/settlements", {
    method: "POST",
    body: JSON.stringify({ case_id: id, cash_settled: n }),
  });
  if (r.ok) { setMsg(`精算確定（台帳${r.data!.daicho_count}件生成）`); load(); }
  else setMsg(r.error);
}
```

- [ ] **Step 3: ビルド確認** — Run: `npm run build` → 成功
- [ ] **Step 4: Commit**
```bash
git add app/cases/[id]/page.tsx
git commit -m "feat: case detail — verification status + settlement confirm UI"
```

---

### Task 7: 結線・手動E2E・RUNBOOK更新

**Files:**
- Modify: `docs/RUNBOOK.md`

- [ ] **Step 1: RUNBOOK に Phase 2 を追記**
  - マイグレーション0003 の適用
  - 本人確認→精算確定→台帳生成→クローズの E2E 手順
  - 古物台帳の確認方法（`select * from kobutsu_daicho`）と3年保管の運用注意
- [ ] **Step 2: 全テスト** — Run: `npm run test` → 全PASS
- [ ] **Step 3: 手動E2E（実機）**
  1. 買取明細のある案件で本人確認（身分証＋職業＋生年）
  2. 本人確認せず精算 → ブロックされること
  3. 本人確認後に精算確定 → settlements + kobutsu_daicho が買取件数分生成・case closed
  4. 顧客名を後から変更 → 台帳の customer_name が不変（スナップショット）
  5. 回収のみ案件 → 本人確認なしで精算可（台帳0件）
- [ ] **Step 4: Commit**
```bash
git add docs/RUNBOOK.md
git commit -m "docs: RUNBOOK Phase 2 (verification, settlement, kobutsu daicho)"
```

---

## 完了の定義（Phase 2）
- 全ユニットテスト PASS（money 11件 + settlement）
- `npm run build` 成功
- 本人確認→精算確定→台帳自動生成→クローズが通る
- 台帳が法定5項目を満たし、顧客変更に追従しない（スナップショット）

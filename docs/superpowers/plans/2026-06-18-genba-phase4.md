# GENBA Phase 4 Implementation Plan — 紹介フィー

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans。checkbox 形式。

**Goal:** TK/アンバサダー/フィー率を管理し、紹介案件の精算時に referral_fees を仕様ロジック通り自動生成、支払い管理（未払い/支払済）まで。

**Architecture:** Phase 1-3 基盤に積む。新テーブル tk/ambassadors/fee_settings/referral_fees、フィー計算 `lib/fee.ts`、既存精算APIにフィー生成を追加、マスタ/台帳画面。

## Global Constraints
- 金額 integer・フィー計算は決定論・テスト必須。全DB API経由・`{ok,data?,error?}`・`requireStaff`。
- フィー計算は仕様アルゴリズム厳守（直: 全額ambassador / TK経由: tk_share按分・残差ambassador）。
- フィー生成は精算時に1回・冪等。率は現行(effective_from最大)を使用、生成後は再計算しない。

---

### Task 1: マイグレーション0005

**Files:** Create `supabase/migrations/0005_phase4_schema.sql`

- [ ] **Step 1: SQL作成**
```sql
create type payee_type as enum ('ambassador','tk');
create type fee_status as enum ('accrued','paid');

create table tk (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  payment_info text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table ambassadors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  route_code text unique not null,
  tk_id uuid references tk(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table fee_settings (
  id uuid primary key default gen_random_uuid(),
  rate_buy numeric not null,
  rate_work numeric not null,
  tk_share numeric not null,
  ambassador_share numeric not null,
  effective_from date not null,
  created_at timestamptz not null default now()
);

create table referral_fees (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  ambassador_id uuid not null references ambassadors(id),
  tk_id uuid references tk(id),
  fee_buy integer not null,
  fee_work integer not null,
  fee_total integer not null,
  pay_to payee_type not null,
  pay_to_id uuid,
  tk_portion integer,
  ambassador_portion integer,
  status fee_status not null default 'accrued',
  accrued_at timestamptz not null default now(),
  paid_at timestamptz
);
create index idx_referral_fees_status on referral_fees(status);
create index idx_referral_fees_case on referral_fees(case_id);

-- cases.referrer_ambassador_id に FK を付与（Phase 1 で列のみ作成済み）
alter table cases
  add constraint cases_referrer_ambassador_fk
  foreign key (referrer_ambassador_id) references ambassadors(id);
```
- [ ] **Step 2: Supabase適用** — Expected: 4テーブル + 2enum + FK1。
- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/0005_phase4_schema.sql
git commit -m "feat: Phase 4 schema (tk, ambassadors, fee_settings, referral_fees, case FK)"
```

---

### Task 2: フィー計算 `lib/fee.ts`（TDD）

**Files:** Create `lib/fee.ts`, `lib/fee.test.ts`

**Interfaces:**
- `export type FeeResult = { fee_buy:number; fee_work:number; fee_total:number; pay_to:"ambassador"|"tk"; pay_to_id:string; tk_portion:number; ambassador_portion:number }`
- `export function computeReferralFee(input: { buyTotal:number; workTotal:number; rateBuy:number; rateWork:number; tkShare:number; ambassadorId:string; ambassadorTkId:string|null }): FeeResult`

- [ ] **Step 1: 失敗するテスト**

`lib/fee.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeReferralFee } from "@/lib/fee";

describe("computeReferralFee", () => {
  it("直アンバサダー：全額ambassador・tk_portion=0", () => {
    const r = computeReferralFee({
      buyTotal: 100000, workTotal: 20000, rateBuy: 0.05, rateWork: 0.1,
      tkShare: 0.6, ambassadorId: "amb1", ambassadorTkId: null,
    });
    expect(r.fee_buy).toBe(5000);
    expect(r.fee_work).toBe(2000);
    expect(r.fee_total).toBe(7000);
    expect(r.pay_to).toBe("ambassador");
    expect(r.pay_to_id).toBe("amb1");
    expect(r.tk_portion).toBe(0);
    expect(r.ambassador_portion).toBe(7000);
  });

  it("TK経由：tk_share按分・残差ambassador", () => {
    const r = computeReferralFee({
      buyTotal: 100000, workTotal: 20000, rateBuy: 0.05, rateWork: 0.1,
      tkShare: 0.6, ambassadorId: "amb1", ambassadorTkId: "tk1",
    });
    expect(r.fee_total).toBe(7000);
    expect(r.pay_to).toBe("tk");
    expect(r.pay_to_id).toBe("tk1");
    expect(r.tk_portion).toBe(4200);       // round(7000*0.6)
    expect(r.ambassador_portion).toBe(2800);
  });

  it("端数は Math.round", () => {
    const r = computeReferralFee({
      buyTotal: 3333, workTotal: 0, rateBuy: 0.05, rateWork: 0.1,
      tkShare: 0.5, ambassadorId: "a", ambassadorTkId: null,
    });
    expect(r.fee_buy).toBe(167);  // round(166.65)
    expect(r.fee_work).toBe(0);
    expect(r.fee_total).toBe(167);
  });
});
```
- [ ] **Step 2: 失敗確認** — `npm run test -- lib/fee.test.ts` → FAIL
- [ ] **Step 3: 実装**

`lib/fee.ts`:
```ts
export type FeeResult = {
  fee_buy: number;
  fee_work: number;
  fee_total: number;
  pay_to: "ambassador" | "tk";
  pay_to_id: string;
  tk_portion: number;
  ambassador_portion: number;
};

export function computeReferralFee(input: {
  buyTotal: number;
  workTotal: number;
  rateBuy: number;
  rateWork: number;
  tkShare: number;
  ambassadorId: string;
  ambassadorTkId: string | null;
}): FeeResult {
  const fee_buy = Math.round(input.buyTotal * input.rateBuy);
  const fee_work = Math.round(input.workTotal * input.rateWork);
  const fee_total = fee_buy + fee_work;
  if (input.ambassadorTkId == null) {
    return {
      fee_buy, fee_work, fee_total,
      pay_to: "ambassador", pay_to_id: input.ambassadorId,
      tk_portion: 0, ambassador_portion: fee_total,
    };
  }
  const tk_portion = Math.round(fee_total * input.tkShare);
  return {
    fee_buy, fee_work, fee_total,
    pay_to: "tk", pay_to_id: input.ambassadorTkId,
    tk_portion, ambassador_portion: fee_total - tk_portion,
  };
}
```
- [ ] **Step 4: 通過確認** — `npm run test -- lib/fee.test.ts` → PASS
- [ ] **Step 5: Commit**
```bash
git add lib/fee.ts lib/fee.test.ts
git commit -m "feat: computeReferralFee deterministic helper (TDD)"
```

---

### Task 3: マスタ API（tk / ambassadors / fee-settings）

**Files:** Create `app/api/tk/route.ts`, `app/api/ambassadors/route.ts`, `app/api/fee-settings/route.ts`

**Interfaces:**
- `GET/POST /api/tk` — list / create `{ name, contact?, payment_info? }`
- `GET/POST /api/ambassadors` — list(tk名ネスト) / create `{ name, route_code, tk_id? }`
- `GET/POST /api/fee-settings` — list(新しい順) / create `{ rate_buy, rate_work, tk_share, ambassador_share, effective_from }`

- [ ] **Step 1: tk API**

`app/api/tk/route.ts`:
```ts
import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { data, error } = await supabaseAdmin()
    .from("tk").select("*").order("created_at", { ascending: false });
  if (error) return fail(error.message, 500);
  return ok(data);
}
export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const b = await req.json();
  if (!b.name) return fail("name は必須", 400);
  const { data, error } = await supabaseAdmin()
    .from("tk").insert({ name: b.name, contact: b.contact ?? null, payment_info: b.payment_info ?? null })
    .select("id").single();
  if (error) return fail(error.message, 500);
  return ok({ id: data.id });
}
```

- [ ] **Step 2: ambassadors API**

`app/api/ambassadors/route.ts`:
```ts
import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { data, error } = await supabaseAdmin()
    .from("ambassadors").select("id,name,route_code,active,tk:tk(id,name)")
    .order("created_at", { ascending: false });
  if (error) return fail(error.message, 500);
  return ok(data);
}
export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const b = await req.json();
  if (!b.name || !b.route_code) return fail("name / route_code は必須", 400);
  const { data, error } = await supabaseAdmin()
    .from("ambassadors").insert({ name: b.name, route_code: b.route_code, tk_id: b.tk_id ?? null })
    .select("id").single();
  if (error) return fail(error.message.includes("duplicate") ? "route_code が重複しています" : error.message, 400);
  return ok({ id: data.id });
}
```

- [ ] **Step 3: fee-settings API**

`app/api/fee-settings/route.ts`:
```ts
import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { data, error } = await supabaseAdmin()
    .from("fee_settings").select("*").order("effective_from", { ascending: false });
  if (error) return fail(error.message, 500);
  return ok(data);
}
export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const b = await req.json();
  for (const k of ["rate_buy", "rate_work", "tk_share", "ambassador_share"]) {
    if (typeof b[k] !== "number") return fail(`${k} は数値必須`, 400);
  }
  if (!b.effective_from) return fail("effective_from は必須", 400);
  const { data, error } = await supabaseAdmin()
    .from("fee_settings").insert({
      rate_buy: b.rate_buy, rate_work: b.rate_work, tk_share: b.tk_share,
      ambassador_share: b.ambassador_share, effective_from: b.effective_from,
    }).select("id").single();
  if (error) return fail(error.message, 500);
  return ok({ id: data.id });
}
```
- [ ] **Step 4: ビルド** — `npm run build` → 成功
- [ ] **Step 5: Commit**
```bash
git add app/api/tk app/api/ambassadors app/api/fee-settings
git commit -m "feat: master APIs (tk, ambassadors, fee-settings)"
```

---

### Task 4: マスタ画面（/settings/*）

**Files:** Create `app/settings/tk/page.tsx`, `app/settings/ambassadors/page.tsx`, `app/settings/fees/page.tsx`

**Interfaces:** Consumes Task 3 APIs。

- [ ] **Step 1: TK画面**

`app/settings/tk/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/liffClient";

type Tk = { id: string; name: string; contact: string | null };
export default function TkPage() {
  const [rows, setRows] = useState<Tk[]>([]);
  const [form, setForm] = useState({ name: "", contact: "", payment_info: "" });
  const [msg, setMsg] = useState<string>();
  async function load() { const r = await apiFetch<Tk[]>("/api/tk"); if (r.ok) setRows(r.data ?? []); }
  useEffect(() => { load(); }, []);
  async function add() {
    if (!form.name) { setMsg("名前は必須"); return; }
    const r = await apiFetch("/api/tk", { method: "POST", body: JSON.stringify(form) });
    if (r.ok) { setForm({ name: "", contact: "", payment_info: "" }); load(); } else setMsg(r.error);
  }
  return (
    <main className="p-4 space-y-3">
      <h1 className="text-lg font-bold">TK（統括）</h1>
      <input className="border p-2 w-full" placeholder="名前" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input className="border p-2 w-full" placeholder="連絡先" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
      <input className="border p-2 w-full" placeholder="振込先など" value={form.payment_info} onChange={(e) => setForm({ ...form, payment_info: e.target.value })} />
      {msg && <p className="text-red-600">{msg}</p>}
      <button onClick={add} className="bg-black text-white w-full py-2 rounded">TKを追加</button>
      <ul className="divide-y">{rows.map((t) => <li key={t.id} className="py-2">{t.name}（{t.contact ?? "-"}）</li>)}</ul>
    </main>
  );
}
```

- [ ] **Step 2: アンバサダー画面**

`app/settings/ambassadors/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/liffClient";

type Tk = { id: string; name: string };
type Amb = { id: string; name: string; route_code: string; tk: { name: string } | null };
export default function AmbassadorsPage() {
  const [rows, setRows] = useState<Amb[]>([]);
  const [tks, setTks] = useState<Tk[]>([]);
  const [form, setForm] = useState({ name: "", route_code: "", tk_id: "" });
  const [msg, setMsg] = useState<string>();
  async function load() {
    const r = await apiFetch<Amb[]>("/api/ambassadors"); if (r.ok) setRows(r.data ?? []);
    const t = await apiFetch<Tk[]>("/api/tk"); if (t.ok) setTks(t.data ?? []);
  }
  useEffect(() => { load(); }, []);
  async function add() {
    if (!form.name || !form.route_code) { setMsg("名前と紹介コードは必須"); return; }
    const r = await apiFetch("/api/ambassadors", {
      method: "POST",
      body: JSON.stringify({ name: form.name, route_code: form.route_code, tk_id: form.tk_id || null }),
    });
    if (r.ok) { setForm({ name: "", route_code: "", tk_id: "" }); load(); } else setMsg(r.error);
  }
  return (
    <main className="p-4 space-y-3">
      <h1 className="text-lg font-bold">アンバサダー</h1>
      <input className="border p-2 w-full" placeholder="名前" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <input className="border p-2 w-full" placeholder="紹介コード（route_code）" value={form.route_code} onChange={(e) => setForm({ ...form, route_code: e.target.value })} />
      <select className="border p-2 w-full" value={form.tk_id} onChange={(e) => setForm({ ...form, tk_id: e.target.value })}>
        <option value="">直（TKなし）</option>
        {tks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {msg && <p className="text-red-600">{msg}</p>}
      <button onClick={add} className="bg-black text-white w-full py-2 rounded">アンバサダーを追加</button>
      <ul className="divide-y">{rows.map((a) => <li key={a.id} className="py-2">{a.name}（{a.route_code}）/ {a.tk?.name ?? "直"}</li>)}</ul>
    </main>
  );
}
```

- [ ] **Step 3: フィー率画面**

`app/settings/fees/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/liffClient";

type Fee = { id: string; rate_buy: number; rate_work: number; tk_share: number; ambassador_share: number; effective_from: string };
export default function FeesPage() {
  const [rows, setRows] = useState<Fee[]>([]);
  const [form, setForm] = useState({ rate_buy: "0.05", rate_work: "0.1", tk_share: "0.6", ambassador_share: "0.4", effective_from: "" });
  const [msg, setMsg] = useState<string>();
  async function load() { const r = await apiFetch<Fee[]>("/api/fee-settings"); if (r.ok) setRows(r.data ?? []); }
  useEffect(() => { load(); }, []);
  async function add() {
    if (!form.effective_from) { setMsg("適用開始日は必須"); return; }
    const r = await apiFetch("/api/fee-settings", {
      method: "POST",
      body: JSON.stringify({
        rate_buy: parseFloat(form.rate_buy), rate_work: parseFloat(form.rate_work),
        tk_share: parseFloat(form.tk_share), ambassador_share: parseFloat(form.ambassador_share),
        effective_from: form.effective_from,
      }),
    });
    if (r.ok) load(); else setMsg(r.error);
  }
  return (
    <main className="p-4 space-y-3">
      <h1 className="text-lg font-bold">フィー率設定</h1>
      <p className="text-xs text-gray-500">率は小数（5% = 0.05）。ambassador_share は参考値（計算は tk_share の残差）。</p>
      <label className="text-sm">買取料率<input className="border p-2 w-full" value={form.rate_buy} onChange={(e) => setForm({ ...form, rate_buy: e.target.value })} /></label>
      <label className="text-sm">作業費料率<input className="border p-2 w-full" value={form.rate_work} onChange={(e) => setForm({ ...form, rate_work: e.target.value })} /></label>
      <label className="text-sm">TK取り分<input className="border p-2 w-full" value={form.tk_share} onChange={(e) => setForm({ ...form, tk_share: e.target.value })} /></label>
      <label className="text-sm">アンバサダー取り分(参考)<input className="border p-2 w-full" value={form.ambassador_share} onChange={(e) => setForm({ ...form, ambassador_share: e.target.value })} /></label>
      <label className="text-sm">適用開始日<input className="border p-2 w-full" type="date" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} /></label>
      {msg && <p className="text-red-600">{msg}</p>}
      <button onClick={add} className="bg-black text-white w-full py-2 rounded">この率を追加</button>
      <ul className="divide-y text-sm">{rows.map((f) => <li key={f.id} className="py-2">{f.effective_from}〜 買{f.rate_buy}/作{f.rate_work}/TK{f.tk_share}</li>)}</ul>
    </main>
  );
}
```
- [ ] **Step 4: ビルド** — `npm run build` → 成功
- [ ] **Step 5: Commit**
```bash
git add app/settings
git commit -m "feat: master screens (tk, ambassadors, fee settings)"
```

---

### Task 5: 予約登録に紹介元アンバサダー選択を追加（cases API 拡張）

**Files:** Modify `app/api/cases/route.ts`, `app/cases/new/page.tsx`

- [ ] **Step 1: cases 作成APIで referrer_ambassador_id を受ける**

`app/api/cases/route.ts` の POST、cases insert に追加：
```ts
      source: body.source,
      referrer_ambassador_id: body.referrer_ambassador_id ?? null,
      registered_by: guard.staff.id,
```

- [ ] **Step 2: 予約登録画面に source=referral 時のアンバサダー選択**

`app/cases/new/page.tsx`:
- state 追加：`const [ambassadors, setAmbassadors] = useState<{id:string;name:string}[]>([]); const [ambId, setAmbId] = useState("");`
- `useEffect(() => { apiFetch<{id:string;name:string}[]>("/api/ambassadors").then(r => r.ok && setAmbassadors(r.data ?? [])); }, []);`
- source セレクトの直後に：
```tsx
{form.source === "referral" && (
  <select className="border p-2 w-full" value={ambId} onChange={(e) => setAmbId(e.target.value)}>
    <option value="">紹介アンバサダーを選択</option>
    {ambassadors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
  </select>
)}
```
- submit の body に `referrer_ambassador_id: form.source === "referral" ? (ambId || null) : null` を追加。

- [ ] **Step 3: ビルド** — `npm run build` → 成功
- [ ] **Step 4: Commit**
```bash
git add app/api/cases/route.ts app/cases/new/page.tsx
git commit -m "feat: link referrer ambassador on referral cases"
```

---

### Task 6: 精算APIにフィー自動生成を追加

**Files:** Modify `app/api/settlements/route.ts`

**Interfaces:** 既存 `POST /api/settlements` の返却に `referral_fee_total: number | null` を追加。

- [ ] **Step 1: settlements 取得に referrer を含める**

`app/api/settlements/route.ts` の case select を拡張：
```ts
  const c = await db
    .from("cases")
    .select(
      "id, verification_method, id_media_id, referrer_ambassador_id, customer:customers(name,address,occupation,birth_year)"
    )
    .eq("id", case_id)
    .maybeSingle();
```

- [ ] **Step 2: case close の直前にフィー生成ブロックを追加**

`import { computeReferralFee } from "@/lib/fee";` を先頭に追加。クローズ処理の直前に：
```ts
  // 紹介フィー自動生成（紹介案件のみ・冪等）
  let referral_fee_total: number | null = null;
  const refAmbId = (c.data as unknown as { referrer_ambassador_id: string | null }).referrer_ambassador_id;
  if (refAmbId) {
    const dup = await db.from("referral_fees").select("id").eq("case_id", case_id).maybeSingle();
    if (!dup.data) {
      const fs = await db
        .from("fee_settings")
        .select("rate_buy,rate_work,tk_share")
        .lte("effective_from", new Date().toISOString().slice(0, 10))
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();
      const amb = await db.from("ambassadors").select("id,tk_id").eq("id", refAmbId).maybeSingle();
      if (fs.data && amb.data) {
        const fee = computeReferralFee({
          buyTotal: buy_total,
          workTotal: work_total,
          rateBuy: Number(fs.data.rate_buy),
          rateWork: Number(fs.data.rate_work),
          tkShare: Number(fs.data.tk_share),
          ambassadorId: amb.data.id,
          ambassadorTkId: amb.data.tk_id ?? null,
        });
        const fins = await db.from("referral_fees").insert({
          case_id,
          ambassador_id: amb.data.id,
          tk_id: amb.data.tk_id ?? null,
          fee_buy: fee.fee_buy,
          fee_work: fee.fee_work,
          fee_total: fee.fee_total,
          pay_to: fee.pay_to,
          pay_to_id: fee.pay_to_id,
          tk_portion: fee.tk_portion,
          ambassador_portion: fee.ambassador_portion,
          accrued_at: new Date().toISOString(),
        });
        if (!fins.error) referral_fee_total = fee.fee_total;
      }
    }
  }
```
返却に追加：
```ts
  return ok({ buy_total, work_total, net_amount, cash_settled, daicho_count, referral_fee_total });
```

- [ ] **Step 2b: 案件詳細の精算結果メッセージ（任意）**
`app/cases/[id]/page.tsx` の settle() 成功時メッセージはそのままで可（daicho_count を表示中）。フィーは台帳画面で確認するため変更不要。

- [ ] **Step 3: ビルド + 全テスト** — `npm run build` 成功 / `npm run test` 全PASS
- [ ] **Step 4: Commit**
```bash
git add app/api/settlements/route.ts
git commit -m "feat: auto-generate referral fee on settlement (idempotent, current rate)"
```

---

### Task 7: フィー台帳 API + 画面 + RUNBOOK

**Files:** Create `app/api/referral-fees/route.ts`, `app/api/referral-fees/[id]/route.ts`, `app/fees/page.tsx`; Modify `docs/RUNBOOK.md`, `app/page.tsx`

**Interfaces:**
- `GET /api/referral-fees?status=` → 一覧（ambassador名・tk名ネスト）
- `PATCH /api/referral-fees/[id]` body `{ status:'paid' }` → `data:{ id }`（paid_at=now）

- [ ] **Step 1: 台帳一覧 API**

`app/api/referral-fees/route.ts`:
```ts
import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const status = new URL(req.url).searchParams.get("status");
  let q = supabaseAdmin()
    .from("referral_fees")
    .select("id,fee_total,pay_to,tk_portion,ambassador_portion,status,accrued_at,ambassador:ambassadors(name),tk:tk(name)")
    .order("accrued_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return fail(error.message, 500);
  return ok(data);
}
```

- [ ] **Step 2: 支払済更新 API**

`app/api/referral-fees/[id]/route.ts`:
```ts
import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const b = await req.json();
  if (b.status !== "paid") return fail("status は paid のみ", 400);
  const { error } = await supabaseAdmin()
    .from("referral_fees").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
  if (error) return fail(error.message, 500);
  return ok({ id });
}
```

- [ ] **Step 3: フィー台帳画面**

`app/fees/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/liffClient";
import { formatYen } from "@/lib/money";

type Fee = {
  id: string; fee_total: number; pay_to: string; tk_portion: number | null;
  ambassador_portion: number | null; status: string;
  ambassador: { name: string } | null; tk: { name: string } | null;
};
const TABS = [["accrued","未払い"],["paid","支払済"]] as const;

export default function FeesPage() {
  const [tab, setTab] = useState("accrued");
  const [rows, setRows] = useState<Fee[]>([]);
  const [msg, setMsg] = useState<string>();
  async function load() {
    const r = await apiFetch<Fee[]>(`/api/referral-fees?status=${tab}`);
    if (r.ok) setRows(r.data ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);
  async function pay(id: string) {
    const r = await apiFetch(`/api/referral-fees/${id}`, { method: "PATCH", body: JSON.stringify({ status: "paid" }) });
    if (r.ok) load(); else setMsg(r.error);
  }
  const total = rows.reduce((a, f) => a + f.fee_total, 0);
  return (
    <main className="p-4 space-y-4">
      <h1 className="text-lg font-bold">フィー台帳</h1>
      <div className="flex gap-2">
        {TABS.map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={`px-3 py-1 rounded ${tab===v?"bg-black text-white":"bg-gray-200"}`}>{l}</button>
        ))}
      </div>
      <p className="text-sm">合計: <b>{formatYen(total)}</b></p>
      {msg && <p className="text-red-600">{msg}</p>}
      <ul className="divide-y">
        {rows.map((f) => (
          <li key={f.id} className="py-2 text-sm">
            <div className="flex justify-between">
              <span>支払先: {f.pay_to === "tk" ? `TK ${f.tk?.name ?? ""}` : `${f.ambassador?.name ?? ""}（直）`}</span>
              <b>{formatYen(f.fee_total)}</b>
            </div>
            <div className="text-xs text-gray-500">紹介: {f.ambassador?.name ?? "-"} ／ 内訳 TK{formatYen(f.tk_portion ?? 0)}・アンバ{formatYen(f.ambassador_portion ?? 0)}</div>
            {f.status === "accrued" && <button onClick={() => pay(f.id)} className="mt-1 bg-green-700 text-white px-3 py-1 rounded text-xs">支払済にする</button>}
          </li>
        ))}
        {rows.length === 0 && <li className="py-6 text-gray-400">該当なし</li>}
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: トップ導線 + RUNBOOK**
`app/page.tsx` に `/fees` と `/settings/ambassadors` 等への簡易リンクを追加。`docs/RUNBOOK.md` に Phase 4（migration 0005適用・マスタ登録→紹介案件→精算→台帳のE2E）を追記。

- [ ] **Step 5: ビルド + 全テスト** — `npm run build` 成功 / `npm run test` 全PASS
- [ ] **Step 6: Commit**
```bash
git add app/api/referral-fees app/fees app/page.tsx docs/RUNBOOK.md
git commit -m "feat: referral fee ledger (list + mark paid) + nav + runbook"
```

---

## 完了の定義（Phase 4）
- 全ユニットテスト PASS（fee: computeReferralFee 含む）
- `npm run build` 成功
- マスタ登録→紹介案件紐付け→精算でフィー自動生成→台帳で未払い/支払済が回る
- 直/TK経由で支払い先・内訳が仕様通り

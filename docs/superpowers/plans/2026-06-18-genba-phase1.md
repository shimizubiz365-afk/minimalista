# GENBA Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 出張買取の中核業務（予約→案件→買取/回収入力→買取伝票・領収書PDF発行）を LINE 内 LIFF アプリとして1本通す。

**Architecture:** 単一の Next.js 16 (App Router) アプリを LIFF エンドポイントとして配信。画面は client components、DB/Storage/PDF はすべて Next.js API routes（server）経由でアクセスし、Supabase の service_role キーはサーバーのみが保持する。認証は LINE ログイン（LIFF IDトークン）をサーバーで検証し `staff.line_user_id` で突合。

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, Supabase (Postgres + Storage), @line/liff, @react-pdf/renderer, Vitest（ユニットテスト）

## Global Constraints

- 単一テナント（自社専用）。`tenant_id` は持たない。RLS は当面オフ（サーバー側でゲート）。
- 金額はすべて `integer`（円・最小単位）。浮動小数を使わない。金額・合計の計算は決定論的に実装しテストする。AIは介在させない。
- 日時は `timestamptz`、主キーは `uuid default gen_random_uuid()`。
- クライアントから Supabase を直接呼ばない。全 DB/Storage アクセスは API route 経由。`SUPABASE_SERVICE_ROLE_KEY` はサーバー専用、クライアントに露出させない。
- API route のレスポンスは必ず `{ ok: boolean, data?: T, error?: string }` 形式。
- Phase 1 で作るテーブルは 8 つ: staff / customers / cases / call_logs / purchase_items / collection_items / media / documents。それ以外（settlements / kobutsu_daicho / products / sales / tk / ambassadors / fee_settings / referral_fees）は作らない。
- Node.js 20+ / npm。

---

### Task 1: プロジェクト足場（Next.js + Tailwind + 依存 + env テンプレ）

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`
- Create: `.env.local.example`, `.gitignore`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: 起動可能な Next.js アプリ（`npm run dev`）、`npm run test`（Vitest）、`npm run build`。

- [ ] **Step 1: Next.js を生成して依存を入れる**

Run:
```bash
cd /root/minimalista
npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm --yes
npm install @line/liff @supabase/supabase-js @react-pdf/renderer
npm install -D vitest @vitejs/plugin-react
```
Expected: `app/`, `package.json`, `tailwind` 設定が生成される。`docs/` は既存のまま残る。

- [ ] **Step 2: package.json に test スクリプトを追加**

`package.json` の `"scripts"` に追記:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: vitest.config.ts を作成**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "node", include: ["**/*.test.{ts,tsx}"] },
  resolve: { alias: { "@": __dirname } },
});
```

- [ ] **Step 4: .env.local.example を作成**

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
# LINE LIFF
NEXT_PUBLIC_LIFF_ID=
LINE_LOGIN_CHANNEL_ID=
# 会社情報（買取伝票・領収書に印字）
COMPANY_NAME=ミニマリスタ
COMPANY_KOBUTSU_LICENSE=未設定
COMPANY_ADDRESS=未設定
COMPANY_TEL=未設定
```
そして `.gitignore` に `.env.local` が含まれることを確認（create-next-app が追加済みのはず。無ければ追記）。

- [ ] **Step 5: 動作確認**

Run: `npm run build`
Expected: ビルド成功（エラーなし）。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind, Supabase, LIFF, react-pdf deps"
```

---

### Task 2: DBマイグレーション（enum + 8テーブル + 採番トリガ + Storage バケット）

**Files:**
- Create: `supabase/migrations/0001_phase1_schema.sql`
- Create: `supabase/migrations/0002_storage_buckets.sql`

**Interfaces:**
- Produces: Supabase 上に Phase 1 のスキーマ。テーブル名・列名は spec §3 と一致。

- [ ] **Step 1: スキーマ SQL を作成**

`supabase/migrations/0001_phase1_schema.sql`:
```sql
-- enums
create type case_status as enum ('reserved','visiting','visited','pending_pickup','closed','cancelled');
create type lead_source as enum ('phone','line','email','referral');
create type media_kind  as enum ('purchase','collection','id_doc');
create type doc_type     as enum ('purchase_slip','receipt');

-- staff
create table staff (
  id uuid primary key default gen_random_uuid(),
  line_user_id text unique,
  auth_user_id uuid,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_staff_line_user_id on staff(line_user_id);

-- customers + customer_no 採番
create sequence customer_no_seq;
create table customers (
  id uuid primary key default gen_random_uuid(),
  customer_no text unique not null,
  name text not null,
  name_kana text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);
create index idx_customers_phone on customers(phone);

create or replace function set_customer_no() returns trigger as $$
begin
  if new.customer_no is null then
    new.customer_no := 'C-' || lpad(nextval('customer_no_seq')::text, 6, '0');
  end if;
  return new;
end;
$$ language plpgsql;
create trigger trg_set_customer_no before insert on customers
  for each row execute function set_customer_no();

-- cases
create table cases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  status case_status not null default 'reserved',
  visit_at timestamptz,
  area text,
  desired_items text,
  source lead_source not null,
  referrer_ambassador_id uuid,
  registered_by uuid references staff(id),
  assigned_to uuid references staff(id),
  memo text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index idx_cases_status on cases(status);
create index idx_cases_customer on cases(customer_id);

-- call_logs
create table call_logs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  called_at timestamptz not null,
  result_memo text,
  created_by uuid references staff(id),
  created_at timestamptz not null default now()
);

-- purchase_items
create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  name text not null,
  brand text,
  model text,
  condition text,
  amount integer not null,
  created_by uuid references staff(id),
  created_at timestamptz not null default now()
);
create index idx_purchase_items_case on purchase_items(case_id);

-- collection_items
create table collection_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  item_name text not null,
  work_fee integer not null,
  created_by uuid references staff(id),
  created_at timestamptz not null default now()
);
create index idx_collection_items_case on collection_items(case_id);

-- media
create table media (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  kind media_kind not null,
  purchase_item_id uuid references purchase_items(id),
  collection_item_id uuid references collection_items(id),
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index idx_media_case on media(case_id);

-- documents
create table documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  type doc_type not null,
  storage_path text not null,
  issued_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_method text
);
create index idx_documents_case on documents(case_id);
```

- [ ] **Step 2: Storage バケット SQL を作成**

`supabase/migrations/0002_storage_buckets.sql`:
```sql
insert into storage.buckets (id, name, public) values ('media','media',false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('documents','documents',false)
  on conflict (id) do nothing;
```

- [ ] **Step 3: Supabase に適用**

Supabase プロジェクトの SQL エディタ（または MCP `apply_migration`）で `0001` → `0002` の順に実行。
Expected: 8 テーブル + 2 バケットが作成される。`select count(*) from staff;` が `0` を返す。

- [ ] **Step 4: 動作確認用にスタッフを1人投入（自分の line_user_id は後で更新）**

```sql
insert into staff (name, active) values ('Shun', true);
```

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: Phase 1 DB schema (8 tables, customer_no trigger, storage buckets)"
```

---

### Task 3: 会社情報設定 + 金額決定論ロジック（TDD）

**Files:**
- Create: `lib/company.ts`
- Create: `lib/money.ts`
- Test: `lib/money.test.ts`

**Interfaces:**
- Produces:
  - `lib/company.ts`: `export const company: { name: string; kobutsuLicense: string; address: string; tel: string }`（env から読む）
  - `lib/money.ts`: `export function sumAmounts(items: { amount: number }[]): number` / `export function sumWorkFees(items: { work_fee: number }[]): number` / `export function formatYen(n: number): string`

- [ ] **Step 1: 失敗するテストを書く**

`lib/money.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { sumAmounts, sumWorkFees, formatYen } from "@/lib/money";

describe("sumAmounts", () => {
  it("空配列は0", () => expect(sumAmounts([])).toBe(0));
  it("1件", () => expect(sumAmounts([{ amount: 1500 }])).toBe(1500));
  it("複数件", () => expect(sumAmounts([{ amount: 1500 }, { amount: 320 }, { amount: 80 }])).toBe(1900));
  it("大きい額", () => expect(sumAmounts([{ amount: 1000000 }, { amount: 2500000 }])).toBe(3500000));
});

describe("sumWorkFees", () => {
  it("空配列は0", () => expect(sumWorkFees([])).toBe(0));
  it("複数件", () => expect(sumWorkFees([{ work_fee: 3000 }, { work_fee: 5000 }])).toBe(8000));
});

describe("formatYen", () => {
  it("3桁区切り+円", () => expect(formatYen(1234567)).toBe("¥1,234,567"));
  it("0", () => expect(formatYen(0)).toBe("¥0"));
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test`
Expected: FAIL（`@/lib/money` が無い）

- [ ] **Step 3: 実装を書く**

`lib/money.ts`:
```ts
export function sumAmounts(items: { amount: number }[]): number {
  return items.reduce((acc, i) => acc + i.amount, 0);
}
export function sumWorkFees(items: { work_fee: number }[]): number {
  return items.reduce((acc, i) => acc + i.work_fee, 0);
}
export function formatYen(n: number): string {
  return "¥" + n.toLocaleString("ja-JP");
}
```

`lib/company.ts`:
```ts
export const company = {
  name: process.env.COMPANY_NAME ?? "ミニマリスタ",
  kobutsuLicense: process.env.COMPANY_KOBUTSU_LICENSE ?? "未設定",
  address: process.env.COMPANY_ADDRESS ?? "未設定",
  tel: process.env.COMPANY_TEL ?? "未設定",
};
```

- [ ] **Step 4: テストを実行して通過を確認**

Run: `npm run test`
Expected: PASS（全 8 ケース）

- [ ] **Step 5: Commit**

```bash
git add lib/money.ts lib/money.test.ts lib/company.ts
git commit -m "feat: deterministic money helpers + company config (TDD)"
```

---

### Task 4: PDF 日本語フォント単体検証（最大の罠を先に潰す）

**Files:**
- Create: `lib/pdf/font.ts`
- Create: `public/fonts/NotoSansJP-Regular.ttf`, `public/fonts/NotoSansJP-Bold.ttf`
- Create: `lib/pdf/renderToBuffer.ts`
- Test: `lib/pdf/font.test.ts`

**Interfaces:**
- Produces:
  - `lib/pdf/font.ts`: `export function registerJpFont(): void`（@react-pdf/renderer の `Font.register` を Noto Sans JP で実行。冪等）
  - `lib/pdf/renderToBuffer.ts`: `export async function renderToBuffer(element: React.ReactElement): Promise<Buffer>`

- [ ] **Step 1: フォントを配置**

Run:
```bash
mkdir -p public/fonts
curl -L -o public/fonts/NotoSansJP-Regular.ttf "https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/JP/NotoSansJP-Regular.otf" || true
```
※ 取得元が変わっていることがある。`.ttf`/`.otf` の Noto Sans JP Regular/Bold を `public/fonts/` に置ければ何でもよい。手元にあるものを置く。**日本語グリフを含むフォントであることが必須**。

- [ ] **Step 2: フォント登録 + レンダラを実装**

`lib/pdf/font.ts`:
```ts
import { Font } from "@react-pdf/renderer";
import path from "path";

let registered = false;
export function registerJpFont(): void {
  if (registered) return;
  Font.register({
    family: "NotoSansJP",
    fonts: [
      { src: path.join(process.cwd(), "public/fonts/NotoSansJP-Regular.ttf") },
      { src: path.join(process.cwd(), "public/fonts/NotoSansJP-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  registered = true;
}
```
※ Bold が無ければ Regular を bold にも割り当ててよい。

`lib/pdf/renderToBuffer.ts`:
```ts
import { renderToBuffer as rpdfRenderToBuffer } from "@react-pdf/renderer";
import { registerJpFont } from "./font";
import React from "react";

export async function renderToBuffer(element: React.ReactElement): Promise<Buffer> {
  registerJpFont();
  return rpdfRenderToBuffer(element);
}
```

- [ ] **Step 3: 失敗するテストを書く（日本語PDFが生成できること）**

`lib/pdf/font.test.ts`:
```tsx
import { describe, it, expect } from "vitest";
import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { renderToBuffer } from "@/lib/pdf/renderToBuffer";

describe("PDF 日本語生成", () => {
  it("日本語テキストを含むPDFをBufferで生成できる", async () => {
    const el = (
      <Document>
        <Page style={{ fontFamily: "NotoSansJP", padding: 24 }}>
          <View>
            <Text>買取伝票 テスト 領収書 ミニマリスタ 御中</Text>
          </View>
        </Page>
      </Document>
    );
    const buf = await renderToBuffer(el);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });
});
```

- [ ] **Step 4: テストを実行**

Run: `npm run test -- lib/pdf/font.test.ts`
Expected: 最初は失敗→フォント配置・登録が正しければ PASS。`%PDF-` ヘッダと 1KB 超のサイズで「日本語が含められた」とみなす（文字化けはこの自動テストでは検知できないので、後の手動E2Eで目視確認する旨を Task 14 に記載）。

- [ ] **Step 5: Commit**

```bash
git add lib/pdf/ public/fonts/
git commit -m "feat: react-pdf Japanese font registration + render-to-buffer (font spike)"
```

---

### Task 5: Supabase admin クライアント + LIFF 認証（IDトークン検証 + staff突合）

**Files:**
- Create: `lib/supabaseAdmin.ts`
- Create: `lib/liffAuth.ts`
- Test: `lib/liffAuth.test.ts`

**Interfaces:**
- Consumes: Task 2 の `staff` テーブル。
- Produces:
  - `lib/supabaseAdmin.ts`: `export function supabaseAdmin(): SupabaseClient`（service role、サーバー専用）
  - `lib/liffAuth.ts`:
    - `export async function verifyIdToken(idToken: string): Promise<{ lineUserId: string } | null>`（LINE verify エンドポイント。失敗時 null）
    - `export async function staffFromIdToken(idToken: string): Promise<{ id: string; name: string } | null>`（検証→staff突合→active のみ返す。該当無し/無効は null）

- [ ] **Step 1: supabaseAdmin を実装**

`lib/supabaseAdmin.ts`:
```ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}
```

- [ ] **Step 2: 失敗するテストを書く（staff突合のロジック）**

`lib/liffAuth.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// supabaseAdmin の select().eq().eq().maybeSingle() チェーンをモック
const maybeSingle = vi.fn();
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }) }),
  }),
}));

import { staffFromIdToken } from "@/lib/liffAuth";

function mockVerify(ok: boolean, sub = "U_x") {
  // verifyIdToken は global fetch で LINE verify を叩く
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: async () => (ok ? { sub } : {}),
  }) as unknown as typeof fetch;
}

describe("staffFromIdToken", () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.LINE_LOGIN_CHANNEL_ID = "cid"; });

  it("IDトークン検証に失敗したら null", async () => {
    mockVerify(false);
    expect(await staffFromIdToken("bad")).toBeNull();
  });

  it("検証OKでも該当staffが無ければ null", async () => {
    mockVerify(true);
    maybeSingle.mockResolvedValue({ data: null });
    expect(await staffFromIdToken("ok")).toBeNull();
  });

  it("検証OKでactiveなstaffがあれば {id,name}", async () => {
    mockVerify(true);
    maybeSingle.mockResolvedValue({ data: { id: "s1", name: "Shun" } });
    expect(await staffFromIdToken("ok")).toEqual({ id: "s1", name: "Shun" });
  });
});
```
> 注: モックの `select().eq().eq().maybeSingle()` チェーンは Step 3 の実装の並びと一致させること。

- [ ] **Step 3: 実装を書く**

`lib/liffAuth.ts`:
```ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function verifyIdToken(idToken: string): Promise<{ lineUserId: string } | null> {
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

export async function staffFromIdToken(idToken: string): Promise<{ id: string; name: string } | null> {
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
```

- [ ] **Step 4: テスト実行**

Run: `npm run test -- lib/liffAuth.test.ts`
Expected: PASS（3ケース）

- [ ] **Step 5: Commit**

```bash
git add lib/supabaseAdmin.ts lib/liffAuth.ts lib/liffAuth.test.ts
git commit -m "feat: supabase admin client + LIFF id-token verify & staff lookup (TDD)"
```

---

### Task 6: 共通 API ヘルパ + 認証ガード

**Files:**
- Create: `lib/api.ts`
- Test: `lib/api.test.ts`

**Interfaces:**
- Consumes: `staffFromIdToken`（Task 5）
- Produces:
  - `lib/api.ts`:
    - `export function ok<T>(data: T): Response`（`{ok:true,data}` 200）
    - `export function fail(error: string, status?: number): Response`（`{ok:false,error}`）
    - `export async function requireStaff(req: Request): Promise<{ staff: { id: string; name: string } } | Response>`（`Authorization: Bearer <idToken>` を読み、staff を返すか 401 Response を返す）

- [ ] **Step 1: 失敗するテストを書く**

`lib/api.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { ok, fail } from "@/lib/api";

describe("api helpers", () => {
  it("ok は {ok:true,data}", async () => {
    const r = ok({ a: 1 });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, data: { a: 1 } });
  });
  it("fail は {ok:false,error} と status", async () => {
    const r = fail("boom", 400);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, error: "boom" });
  });
});
```

- [ ] **Step 2: テスト実行（失敗確認）**

Run: `npm run test -- lib/api.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装を書く**

`lib/api.ts`:
```ts
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
```

- [ ] **Step 4: テスト実行（通過）**

Run: `npm run test -- lib/api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/api.ts lib/api.test.ts
git commit -m "feat: API response helpers + requireStaff auth guard"
```

---

### Task 7: 読み取り系 API（案件一覧・案件詳細・顧客名寄せ）

**Files:**
- Create: `app/api/cases/route.ts`（GET 一覧 / POST 作成）
- Create: `app/api/cases/[id]/route.ts`（GET 詳細 / PATCH ステータス）
- Create: `app/api/customers/search/route.ts`（GET 名寄せ）

**Interfaces:**
- Consumes: `ok` / `fail` / `requireStaff`（Task 6）, `supabaseAdmin`（Task 5）
- Produces（client が叩く契約）:
  - `GET /api/cases?status=reserved` → `data: Case[]`（customer をネスト）
  - `POST /api/cases` body `{ customer: {existing_id?, name, name_kana?, phone?, address?}, visit_at, area?, desired_items?, source }` → `data: { id }`
  - `GET /api/cases/[id]` → `data: { case, customer, call_logs, purchase_items, collection_items }`
  - `PATCH /api/cases/[id]` body `{ status }` → `data: { id, status }`
  - `GET /api/customers/search?phone=090...` → `data: Customer[]`

- [ ] **Step 1: 案件一覧・作成 API を実装**

`app/api/cases/route.ts`:
```ts
import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const status = new URL(req.url).searchParams.get("status");
  let q = supabaseAdmin()
    .from("cases")
    .select("id,status,visit_at,area,desired_items,source,memo,customer:customers(id,customer_no,name,phone)")
    .order("visit_at", { ascending: true });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const body = await req.json();
  const db = supabaseAdmin();

  let customerId: string | undefined = body.customer?.existing_id;
  if (!customerId) {
    const { data: c, error: cErr } = await db
      .from("customers")
      .insert({
        name: body.customer.name,
        name_kana: body.customer.name_kana ?? null,
        phone: body.customer.phone ?? null,
        address: body.customer.address ?? null,
      })
      .select("id")
      .single();
    if (cErr) return fail(cErr.message, 500);
    customerId = c.id;
  }

  const { data, error } = await db
    .from("cases")
    .insert({
      customer_id: customerId,
      visit_at: body.visit_at ?? null,
      area: body.area ?? null,
      desired_items: body.desired_items ?? null,
      source: body.source,
      registered_by: guard.staff.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message, 500);
  return ok({ id: data.id });
}
```

- [ ] **Step 2: 案件詳細・ステータス更新 API を実装**

`app/api/cases/[id]/route.ts`:
```ts
import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const db = supabaseAdmin();
  const [c, logs, pi, ci] = await Promise.all([
    db.from("cases").select("*, customer:customers(*)").eq("id", id).maybeSingle(),
    db.from("call_logs").select("*").eq("case_id", id).order("called_at", { ascending: false }),
    db.from("purchase_items").select("*").eq("case_id", id).order("created_at"),
    db.from("collection_items").select("*").eq("case_id", id).order("created_at"),
  ]);
  if (c.error || !c.data) return fail("案件が見つかりません", 404);
  return ok({
    case: c.data,
    customer: (c.data as any).customer,
    call_logs: logs.data ?? [],
    purchase_items: pi.data ?? [],
    collection_items: ci.data ?? [],
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const body = await req.json();
  const allowed = ["reserved","visiting","visited","pending_pickup","closed","cancelled"];
  if (!allowed.includes(body.status)) return fail("不正なステータス", 400);
  const patch: Record<string, unknown> = { status: body.status };
  if (body.status === "closed") patch.closed_at = new Date().toISOString();
  const { data, error } = await supabaseAdmin()
    .from("cases").update(patch).eq("id", id).select("id,status").single();
  if (error) return fail(error.message, 500);
  return ok(data);
}
```

- [ ] **Step 3: 顧客名寄せ API を実装**

`app/api/customers/search/route.ts`:
```ts
import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const phone = new URL(req.url).searchParams.get("phone")?.trim();
  if (!phone) return ok([]);
  const { data, error } = await supabaseAdmin()
    .from("customers")
    .select("id,customer_no,name,name_kana,phone,address")
    .eq("phone", phone)
    .limit(10);
  if (error) return fail(error.message, 500);
  return ok(data);
}
```

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: 型エラーなしでビルド成功。

- [ ] **Step 5: Commit**

```bash
git add app/api/cases app/api/customers
git commit -m "feat: cases (list/create/detail/status) + customer phone-search APIs"
```

---

### Task 8: 明細・画像アップロード API（買取・回収・media）

**Files:**
- Create: `app/api/purchase-items/route.ts`（POST）
- Create: `app/api/collection-items/route.ts`（POST）
- Create: `app/api/media/route.ts`（POST multipart）

**Interfaces:**
- Consumes: `ok`/`fail`/`requireStaff`, `supabaseAdmin`
- Produces:
  - `POST /api/purchase-items` body `{ case_id, name, brand?, model?, condition?, amount }` → `data: { id }`
  - `POST /api/collection-items` body `{ case_id, item_name, work_fee }` → `data: { id }`
  - `POST /api/media` multipart fields `file`, `case_id`, `kind`, `purchase_item_id?`, `collection_item_id?` → `data: { id, storage_path }`

- [ ] **Step 1: 買取明細 API**

`app/api/purchase-items/route.ts`:
```ts
import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const b = await req.json();
  if (!b.case_id || !b.name || typeof b.amount !== "number")
    return fail("case_id / name / amount は必須", 400);
  const { data, error } = await supabaseAdmin().from("purchase_items").insert({
    case_id: b.case_id, name: b.name, brand: b.brand ?? null, model: b.model ?? null,
    condition: b.condition ?? null, amount: b.amount, created_by: guard.staff.id,
  }).select("id").single();
  if (error) return fail(error.message, 500);
  return ok({ id: data.id });
}
```

- [ ] **Step 2: 回収明細 API**

`app/api/collection-items/route.ts`:
```ts
import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const b = await req.json();
  if (!b.case_id || !b.item_name || typeof b.work_fee !== "number")
    return fail("case_id / item_name / work_fee は必須", 400);
  const { data, error } = await supabaseAdmin().from("collection_items").insert({
    case_id: b.case_id, item_name: b.item_name, work_fee: b.work_fee, created_by: guard.staff.id,
  }).select("id").single();
  if (error) return fail(error.message, 500);
  return ok({ id: data.id });
}
```

- [ ] **Step 3: 画像アップロード API**

`app/api/media/route.ts`:
```ts
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
  const up = await db.storage.from("media").upload(storagePath, buf, { contentType: file.type });
  if (up.error) return fail(up.error.message, 500);

  const { data, error } = await db.from("media").insert({
    case_id: caseId, kind,
    purchase_item_id: form.get("purchase_item_id")?.toString() || null,
    collection_item_id: form.get("collection_item_id")?.toString() || null,
    storage_path: storagePath,
  }).select("id, storage_path").single();
  if (error) return fail(error.message, 500);
  return ok({ id: data.id, storage_path: data.storage_path });
}
```

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 5: Commit**

```bash
git add app/api/purchase-items app/api/collection-items app/api/media
git commit -m "feat: purchase/collection item APIs + media upload to Storage"
```

---

### Task 9: PDF テンプレート（買取伝票・領収書）

**Files:**
- Create: `lib/pdf/types.ts`
- Create: `lib/pdf/purchaseSlip.tsx`
- Create: `lib/pdf/receipt.tsx`
- Test: `lib/pdf/templates.test.tsx`

**Interfaces:**
- Consumes: `company`（Task 3）, `formatYen`（Task 3）, `renderToBuffer`（Task 4）
- Produces:
  - `lib/pdf/types.ts`: `export type SlipCustomer = { name: string; address: string | null; customer_no: string }` / `export type PurchaseLine = { name: string; brand: string|null; model: string|null; condition: string|null; amount: number }` / `export type CollectionLine = { item_name: string; work_fee: number }`
  - `lib/pdf/purchaseSlip.tsx`: `export function PurchaseSlip(props: { customer: SlipCustomer; items: PurchaseLine[]; total: number; date: string; staffName: string }): React.ReactElement`
  - `lib/pdf/receipt.tsx`: `export function Receipt(props: { customer: SlipCustomer; items: CollectionLine[]; total: number; date: string; staffName: string }): React.ReactElement`

- [ ] **Step 1: 型を定義**

`lib/pdf/types.ts`:
```ts
export type SlipCustomer = { name: string; address: string | null; customer_no: string };
export type PurchaseLine = { name: string; brand: string | null; model: string | null; condition: string | null; amount: number };
export type CollectionLine = { item_name: string; work_fee: number };
```

- [ ] **Step 2: 買取伝票テンプレート**

`lib/pdf/purchaseSlip.tsx`:
```tsx
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { company } from "@/lib/company";
import { formatYen } from "@/lib/money";
import type { SlipCustomer, PurchaseLine } from "./types";

const s = StyleSheet.create({
  page: { fontFamily: "NotoSansJP", fontSize: 10, padding: 32 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 12, textAlign: "center" },
  row: { flexDirection: "row", borderBottom: "1pt solid #ccc", paddingVertical: 4 },
  cell: { flex: 1 }, amount: { width: 90, textAlign: "right" },
  company: { marginTop: 24, fontSize: 9, textAlign: "right" },
  total: { marginTop: 12, fontSize: 14, fontWeight: "bold", textAlign: "right" },
  meta: { marginBottom: 8 },
});

export function PurchaseSlip(props: {
  customer: SlipCustomer; items: PurchaseLine[]; total: number; date: string; staffName: string;
}): React.ReactElement {
  return (
    <Document>
      <Page style={s.page}>
        <Text style={s.title}>買取伝票</Text>
        <View style={s.meta}>
          <Text>{props.customer.name} 様（{props.customer.customer_no}）</Text>
          <Text>取引日: {props.date}　担当: {props.staffName}</Text>
        </View>
        <View style={[s.row, { fontWeight: "bold" }]}>
          <Text style={s.cell}>品名 / ブランド / 型番 / 状態</Text>
          <Text style={s.amount}>買取額</Text>
        </View>
        {props.items.map((it, i) => (
          <View style={s.row} key={i}>
            <Text style={s.cell}>{[it.name, it.brand, it.model, it.condition].filter(Boolean).join(" / ")}</Text>
            <Text style={s.amount}>{formatYen(it.amount)}</Text>
          </View>
        ))}
        <Text style={s.total}>買取合計: {formatYen(props.total)}</Text>
        <View style={s.company}>
          <Text>{company.name}</Text>
          <Text>古物商許可番号: {company.kobutsuLicense}</Text>
          <Text>{company.address}　TEL {company.tel}</Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 3: 領収書テンプレート**

`lib/pdf/receipt.tsx`:
```tsx
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { company } from "@/lib/company";
import { formatYen } from "@/lib/money";
import type { SlipCustomer, CollectionLine } from "./types";

const s = StyleSheet.create({
  page: { fontFamily: "NotoSansJP", fontSize: 10, padding: 32 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 12, textAlign: "center" },
  addressee: { fontSize: 12, marginBottom: 8 },
  big: { fontSize: 20, fontWeight: "bold", marginVertical: 12, textAlign: "center" },
  row: { flexDirection: "row", borderBottom: "1pt solid #ccc", paddingVertical: 4 },
  cell: { flex: 1 }, fee: { width: 90, textAlign: "right" },
  note: { marginTop: 8 },
  company: { marginTop: 24, fontSize: 9, textAlign: "right" },
});

export function Receipt(props: {
  customer: SlipCustomer; items: CollectionLine[]; total: number; date: string; staffName: string;
}): React.ReactElement {
  return (
    <Document>
      <Page style={s.page}>
        <Text style={s.title}>領収書</Text>
        <Text style={s.addressee}>{props.customer.name} 様</Text>
        <Text style={s.big}>{formatYen(props.total)}</Text>
        <Text style={s.note}>但し、不用品回収作業費として正に受領いたしました。</Text>
        <View style={[s.row, { fontWeight: "bold", marginTop: 8 }]}>
          <Text style={s.cell}>回収品目</Text>
          <Text style={s.fee}>作業費</Text>
        </View>
        {props.items.map((it, i) => (
          <View style={s.row} key={i}>
            <Text style={s.cell}>{it.item_name}</Text>
            <Text style={s.fee}>{formatYen(it.work_fee)}</Text>
          </View>
        ))}
        <Text style={s.note}>受領日: {props.date}　担当: {props.staffName}</Text>
        <View style={s.company}>
          <Text>{company.name}</Text>
          <Text>古物商許可番号: {company.kobutsuLicense}</Text>
          <Text>{company.address}　TEL {company.tel}</Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 4: テスト（両テンプレートが日本語PDFを生成）**

`lib/pdf/templates.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@/lib/pdf/renderToBuffer";
import { PurchaseSlip } from "@/lib/pdf/purchaseSlip";
import { Receipt } from "@/lib/pdf/receipt";

const cust = { name: "山田太郎", address: "東京都...", customer_no: "C-000001" };

describe("PDFテンプレート", () => {
  it("買取伝票が生成できる", async () => {
    const buf = await renderToBuffer(
      PurchaseSlip({ customer: cust, items: [{ name: "腕時計", brand: "SEIKO", model: null, condition: "美品", amount: 12000 }], total: 12000, date: "2026-06-18", staffName: "Shun" })
    );
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });
  it("領収書が生成できる", async () => {
    const buf = await renderToBuffer(
      Receipt({ customer: cust, items: [{ item_name: "ソファ", work_fee: 5000 }], total: 5000, date: "2026-06-18", staffName: "Shun" })
    );
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });
});
```

- [ ] **Step 5: テスト実行**

Run: `npm run test -- lib/pdf/templates.test.tsx`
Expected: PASS（2ケース）

- [ ] **Step 6: Commit**

```bash
git add lib/pdf/types.ts lib/pdf/purchaseSlip.tsx lib/pdf/receipt.tsx lib/pdf/templates.test.tsx
git commit -m "feat: purchase-slip & receipt PDF templates (TDD)"
```

---

### Task 10: 発行 API（買取伝票・領収書 → 生成 → Storage → documents → 署名URL）

**Files:**
- Create: `lib/pdf/issue.ts`
- Create: `app/api/documents/purchase-slip/route.ts`
- Create: `app/api/documents/receipt/route.ts`

**Interfaces:**
- Consumes: `requireStaff`/`ok`/`fail`, `supabaseAdmin`, `renderToBuffer`, `PurchaseSlip`, `Receipt`, `sumAmounts`, `sumWorkFees`
- Produces:
  - `POST /api/documents/purchase-slip` body `{ case_id }` → `data: { document_id, signed_url }`
  - `POST /api/documents/receipt` body `{ case_id }` → `data: { document_id, signed_url }`
  - `lib/pdf/issue.ts`: `export async function storePdf(caseId: string, type: "purchase_slip"|"receipt", buf: Buffer): Promise<{ document_id: string; signed_url: string }>`

- [ ] **Step 1: 保存ヘルパ `storePdf` を実装**

`lib/pdf/issue.ts`:
```ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function storePdf(
  caseId: string, type: "purchase_slip" | "receipt", buf: Buffer
): Promise<{ document_id: string; signed_url: string }> {
  const db = supabaseAdmin();
  const path = `${caseId}/${type}-${crypto.randomUUID()}.pdf`;
  const up = await db.storage.from("documents").upload(path, buf, { contentType: "application/pdf" });
  if (up.error) throw new Error(up.error.message);
  const { data: doc, error } = await db.from("documents")
    .insert({ case_id: caseId, type, storage_path: path }).select("id").single();
  if (error) throw new Error(error.message);
  const signed = await db.storage.from("documents").createSignedUrl(path, 60 * 30);
  if (signed.error) throw new Error(signed.error.message);
  return { document_id: doc.id, signed_url: signed.data.signedUrl };
}
```

- [ ] **Step 2: 買取伝票発行 API**

`app/api/documents/purchase-slip/route.ts`:
```ts
import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { renderToBuffer } from "@/lib/pdf/renderToBuffer";
import { PurchaseSlip } from "@/lib/pdf/purchaseSlip";
import { sumAmounts } from "@/lib/money";
import { storePdf } from "@/lib/pdf/issue";

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { case_id } = await req.json();
  if (!case_id) return fail("case_id は必須", 400);
  const db = supabaseAdmin();
  const c = await db.from("cases").select("id, customer:customers(name,address,customer_no)").eq("id", case_id).maybeSingle();
  if (c.error || !c.data) return fail("案件が見つかりません", 404);
  const items = await db.from("purchase_items").select("name,brand,model,condition,amount").eq("case_id", case_id).order("created_at");
  if (items.error) return fail(items.error.message, 500);
  const list = items.data ?? [];
  if (list.length === 0) return fail("買取明細がありません", 400);
  const total = sumAmounts(list);
  const cust = (c.data as any).customer;
  try {
    const buf = await renderToBuffer(PurchaseSlip({
      customer: { name: cust.name, address: cust.address, customer_no: cust.customer_no },
      items: list, total, date: new Date().toISOString().slice(0, 10), staffName: guard.staff.name,
    }));
    const res = await storePdf(case_id, "purchase_slip", buf);
    return ok(res);
  } catch (e) {
    return fail("PDF生成または保存に失敗しました: " + (e as Error).message, 500);
  }
}
```

- [ ] **Step 3: 領収書発行 API**

`app/api/documents/receipt/route.ts`:
```ts
import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { renderToBuffer } from "@/lib/pdf/renderToBuffer";
import { Receipt } from "@/lib/pdf/receipt";
import { sumWorkFees } from "@/lib/money";
import { storePdf } from "@/lib/pdf/issue";

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { case_id } = await req.json();
  if (!case_id) return fail("case_id は必須", 400);
  const db = supabaseAdmin();
  const c = await db.from("cases").select("id, customer:customers(name,address,customer_no)").eq("id", case_id).maybeSingle();
  if (c.error || !c.data) return fail("案件が見つかりません", 404);
  const items = await db.from("collection_items").select("item_name,work_fee").eq("case_id", case_id).order("created_at");
  if (items.error) return fail(items.error.message, 500);
  const list = items.data ?? [];
  if (list.length === 0) return fail("回収明細がありません", 400);
  const total = sumWorkFees(list);
  const cust = (c.data as any).customer;
  try {
    const buf = await renderToBuffer(Receipt({
      customer: { name: cust.name, address: cust.address, customer_no: cust.customer_no },
      items: list, total, date: new Date().toISOString().slice(0, 10), staffName: guard.staff.name,
    }));
    const res = await storePdf(case_id, "receipt", buf);
    return ok(res);
  } catch (e) {
    return fail("PDF生成または保存に失敗しました: " + (e as Error).message, 500);
  }
}
```

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 5: Commit**

```bash
git add lib/pdf/issue.ts app/api/documents
git commit -m "feat: purchase-slip & receipt issue APIs (generate→store→signed url)"
```

---

### Task 11: クライアント LIFF 初期化 + 認証付き fetch + アプリシェル

**Files:**
- Create: `lib/liffClient.ts`
- Create: `app/providers.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`（起動→ログイン→案件一覧へ誘導）

**Interfaces:**
- Produces:
  - `lib/liffClient.ts`:
    - `export async function initLiff(): Promise<void>`（`liff.init({ liffId })`、未ログインなら `liff.login()`）
    - `export function getIdToken(): string | null`（`liff.getIDToken()`）
    - `export async function apiFetch<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; data?: T; error?: string }>`（`Authorization: Bearer <idToken>` を自動付与し JSON を返す）

- [ ] **Step 1: liffClient を実装**

`lib/liffClient.ts`:
```ts
"use client";
import liff from "@line/liff";

let initialized = false;
export async function initLiff(): Promise<void> {
  if (initialized) return;
  await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
  if (!liff.isLoggedIn()) { liff.login(); return; }
  initialized = true;
}
export function getIdToken(): string | null {
  try { return liff.getIDToken(); } catch { return null; }
}
export async function apiFetch<T>(path: string, init: RequestInit = {}) {
  const token = getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, headers });
  return (await res.json()) as { ok: boolean; data?: T; error?: string };
}
```

- [ ] **Step 2: providers（LIFF 初期化ゲート）**

`app/providers.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { initLiff } from "@/lib/liffClient";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => { initLiff().then(() => setState("ready")).catch(() => setState("error")); }, []);
  if (state === "loading") return <main className="p-6">読み込み中...</main>;
  if (state === "error") return <main className="p-6">LINEログインに失敗しました。アプリを開き直してください。</main>;
  return <>{children}</>;
}
```

- [ ] **Step 3: layout で providers を適用**

`app/layout.tsx` の `<body>` 内を `<Providers>{children}</Providers>` で包む（`import Providers from "./providers"`）。`<html lang="ja">` にする。

- [ ] **Step 4: トップページ（案件一覧へ誘導）**

`app/page.tsx`:
```tsx
import Link from "next/link";
export default function Home() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-bold">GENBA 出張買取</h1>
      <Link href="/cases" className="block rounded bg-black text-white text-center py-3">案件一覧へ</Link>
    </main>
  );
}
```

- [ ] **Step 5: ビルド確認 & Commit**

Run: `npm run build`
Expected: 成功。
```bash
git add lib/liffClient.ts app/providers.tsx app/layout.tsx app/page.tsx
git commit -m "feat: LIFF init gate + authed apiFetch + app shell"
```

---

### Task 12: 案件一覧（01）+ 予約登録・名寄せ（02）

**Files:**
- Create: `app/cases/page.tsx`
- Create: `app/cases/new/page.tsx`

**Interfaces:**
- Consumes: `apiFetch`（Task 11）, `GET/POST /api/cases`, `GET /api/customers/search`

- [ ] **Step 1: 案件一覧（status タブ）**

`app/cases/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/liffClient";

type CaseRow = { id: string; status: string; visit_at: string | null; area: string | null; customer: { name: string; phone: string | null } };
const TABS = [["reserved","予約"],["visiting","訪問中"],["visited","訪問完了"]] as const;

export default function CasesPage() {
  const [tab, setTab] = useState<string>("reserved");
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [err, setErr] = useState<string>();
  useEffect(() => {
    apiFetch<CaseRow[]>(`/api/cases?status=${tab}`).then(r => r.ok ? setRows(r.data!) : setErr(r.error));
  }, [tab]);
  return (
    <main className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold">案件一覧</h1>
        <Link href="/cases/new" className="rounded bg-black text-white px-3 py-2 text-sm">＋ 予約登録</Link>
      </div>
      <div className="flex gap-2">
        {TABS.map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} className={`px-3 py-1 rounded ${tab===v?"bg-black text-white":"bg-gray-200"}`}>{label}</button>
        ))}
      </div>
      {err && <p className="text-red-600">{err}</p>}
      <ul className="divide-y">
        {rows.map(c => (
          <li key={c.id}>
            <Link href={`/cases/${c.id}`} className="block py-3">
              <div className="font-medium">{c.customer?.name}</div>
              <div className="text-sm text-gray-500">{c.visit_at ?? "日時未定"}・{c.area ?? "エリア未定"}</div>
            </Link>
          </li>
        ))}
        {rows.length === 0 && !err && <li className="py-6 text-gray-400">該当なし</li>}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: 予約登録 + 名寄せ**

`app/cases/new/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/liffClient";

type Cust = { id: string; customer_no: string; name: string; phone: string | null; address: string | null };

export default function NewCasePage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [candidates, setCandidates] = useState<Cust[]>([]);
  const [existingId, setExistingId] = useState<string>();
  const [form, setForm] = useState({ name: "", name_kana: "", address: "", visit_at: "", area: "", desired_items: "", source: "phone" });
  const [err, setErr] = useState<string>();

  async function search() {
    const r = await apiFetch<Cust[]>(`/api/customers/search?phone=${encodeURIComponent(phone)}`);
    if (r.ok) setCandidates(r.data!);
  }
  function pick(c: Cust) {
    setExistingId(c.id);
    setForm(f => ({ ...f, name: c.name, address: c.address ?? "" }));
  }
  async function submit() {
    const body = {
      customer: existingId ? { existing_id: existingId } : { name: form.name, name_kana: form.name_kana, phone, address: form.address },
      visit_at: form.visit_at || null, area: form.area, desired_items: form.desired_items, source: form.source,
    };
    const r = await apiFetch<{ id: string }>("/api/cases", { method: "POST", body: JSON.stringify(body) });
    if (r.ok) router.push(`/cases/${r.data!.id}`); else setErr(r.error);
  }

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-lg font-bold">予約登録</h1>
      <label className="block text-sm">電話番号
        <div className="flex gap-2">
          <input className="border p-2 flex-1" value={phone} onChange={e => setPhone(e.target.value)} onBlur={search} />
          <button onClick={search} className="bg-gray-200 px-3 rounded">検索</button>
        </div>
      </label>
      {candidates.length > 0 && (
        <div className="border rounded p-2 bg-yellow-50 text-sm">
          <p className="font-medium">同じ電話番号の既存顧客（選ぶと紐付け）</p>
          {candidates.map(c => (
            <button key={c.id} onClick={() => pick(c)} className={`block w-full text-left py-1 ${existingId===c.id?"font-bold":""}`}>
              {c.customer_no} {c.name}（{c.address ?? "住所未登録"}）
            </button>
          ))}
          <button onClick={() => setExistingId(undefined)} className="text-blue-600 mt-1">新規として登録する</button>
        </div>
      )}
      <input className="border p-2 w-full" placeholder="氏名" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} disabled={!!existingId} />
      <input className="border p-2 w-full" placeholder="フリガナ" value={form.name_kana} onChange={e => setForm({ ...form, name_kana: e.target.value })} disabled={!!existingId} />
      <input className="border p-2 w-full" placeholder="住所" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} disabled={!!existingId} />
      <input className="border p-2 w-full" type="datetime-local" value={form.visit_at} onChange={e => setForm({ ...form, visit_at: e.target.value })} />
      <input className="border p-2 w-full" placeholder="エリア" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} />
      <input className="border p-2 w-full" placeholder="希望品目" value={form.desired_items} onChange={e => setForm({ ...form, desired_items: e.target.value })} />
      <select className="border p-2 w-full" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
        <option value="phone">電話</option><option value="line">LINE</option><option value="email">メール</option><option value="referral">紹介</option>
      </select>
      {err && <p className="text-red-600">{err}</p>}
      <button onClick={submit} className="bg-black text-white w-full py-3 rounded">登録して案件を開く</button>
    </main>
  );
}
```

- [ ] **Step 3: ビルド確認 & Commit**

Run: `npm run build`
Expected: 成功。
```bash
git add app/cases/page.tsx app/cases/new/page.tsx
git commit -m "feat: case list (status tabs) + reservation form with phone dedup"
```

---

### Task 13: 案件詳細（03）+ ステータス更新 + 発行ボタン

**Files:**
- Create: `app/cases/[id]/page.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `GET/PATCH /api/cases/[id]`, `POST /api/documents/*`, `formatYen`

- [ ] **Step 1: 案件詳細画面**

`app/cases/[id]/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/liffClient";
import { formatYen } from "@/lib/money";

type Detail = {
  case: { id: string; status: string; visit_at: string | null; area: string | null; memo: string | null };
  customer: { name: string; customer_no: string; phone: string | null; address: string | null };
  purchase_items: { id: string; name: string; amount: number }[];
  collection_items: { id: string; item_name: string; work_fee: number }[];
};
const STATUSES = ["reserved","visiting","visited","pending_pickup","closed","cancelled"];

export default function CaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Detail>();
  const [msg, setMsg] = useState<string>();
  const [pdfUrl, setPdfUrl] = useState<string>();

  async function load() {
    const r = await apiFetch<Detail>(`/api/cases/${id}`);
    if (r.ok) setD(r.data!); else setMsg(r.error);
  }
  useEffect(() => { load(); }, [id]);

  async function setStatus(status: string) {
    const r = await apiFetch(`/api/cases/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    if (r.ok) load(); else setMsg(r.error);
  }
  async function issue(kind: "purchase-slip" | "receipt") {
    setMsg("発行中...");
    const r = await apiFetch<{ signed_url: string }>(`/api/documents/${kind}`, { method: "POST", body: JSON.stringify({ case_id: id }) });
    if (r.ok) { setPdfUrl(r.data!.signed_url); setMsg(undefined); } else setMsg(r.error);
  }
  if (!d) return <main className="p-4">{msg ?? "読み込み中..."}</main>;

  const buyTotal = d.purchase_items.reduce((a, i) => a + i.amount, 0);
  const workTotal = d.collection_items.reduce((a, i) => a + i.work_fee, 0);

  return (
    <main className="p-4 space-y-4">
      <div>
        <h1 className="text-lg font-bold">{d.customer.name}（{d.customer.customer_no}）</h1>
        <p className="text-sm text-gray-500">{d.customer.phone}・{d.customer.address}</p>
        <p className="text-sm">訪問: {d.case.visit_at ?? "未定"}・{d.case.area}</p>
      </div>

      <div>
        <label className="text-sm">ステータス</label>
        <select className="border p-2 w-full" value={d.case.status} onChange={e => setStatus(e.target.value)}>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <section>
        <div className="flex justify-between"><h2 className="font-bold">買取明細</h2><Link className="text-blue-600" href={`/cases/${id}/purchase`}>＋入力</Link></div>
        {d.purchase_items.map(i => <div key={i.id} className="flex justify-between py-1 border-b"><span>{i.name}</span><span>{formatYen(i.amount)}</span></div>)}
        <div className="text-right font-bold mt-1">買取合計 {formatYen(buyTotal)}</div>
        <button onClick={() => issue("purchase-slip")} className="mt-2 bg-black text-white w-full py-2 rounded" disabled={d.purchase_items.length===0}>買取伝票PDF発行</button>
      </section>

      <section>
        <div className="flex justify-between"><h2 className="font-bold">回収明細</h2><Link className="text-blue-600" href={`/cases/${id}/collection`}>＋入力</Link></div>
        {d.collection_items.map(i => <div key={i.id} className="flex justify-between py-1 border-b"><span>{i.item_name}</span><span>{formatYen(i.work_fee)}</span></div>)}
        <div className="text-right font-bold mt-1">作業費合計 {formatYen(workTotal)}</div>
        <button onClick={() => issue("receipt")} className="mt-2 bg-black text-white w-full py-2 rounded" disabled={d.collection_items.length===0}>領収書PDF発行</button>
      </section>

      {msg && <p className="text-red-600">{msg}</p>}
      {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" className="block text-center bg-green-600 text-white py-3 rounded">発行したPDFを開く</a>}
    </main>
  );
}
```

- [ ] **Step 2: ビルド確認 & Commit**

Run: `npm run build`
Expected: 成功。
```bash
git add app/cases/[id]/page.tsx
git commit -m "feat: case detail with status update, totals, and PDF issue buttons"
```

---

### Task 14: 買取入力（04）+ 回収入力（04b）+ 写真添付

**Files:**
- Create: `app/cases/[id]/purchase/page.tsx`
- Create: `app/cases/[id]/collection/page.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `POST /api/purchase-items`, `POST /api/collection-items`, `POST /api/media`

- [ ] **Step 1: 買取入力画面**

`app/cases/[id]/purchase/page.tsx`:
```tsx
"use client";
import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/liffClient";

export default function PurchaseInput({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [form, setForm] = useState({ name: "", brand: "", model: "", condition: "", amount: "" });
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string>();

  async function save() {
    const amount = parseInt(form.amount, 10);
    if (!form.name || isNaN(amount)) { setMsg("品名と金額は必須"); return; }
    setMsg("保存中...");
    const r = await apiFetch<{ id: string }>("/api/purchase-items", {
      method: "POST", body: JSON.stringify({ case_id: id, name: form.name, brand: form.brand, model: form.model, condition: form.condition, amount }),
    });
    if (!r.ok) { setMsg(r.error); return; }
    if (file) {
      const fd = new FormData();
      fd.append("file", file); fd.append("case_id", id); fd.append("kind", "purchase"); fd.append("purchase_item_id", r.data!.id);
      const m = await apiFetch("/api/media", { method: "POST", body: fd });
      if (!m.ok) { setMsg("明細は保存できたが写真の保存に失敗: " + m.error); return; }
    }
    router.push(`/cases/${id}`);
  }

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-lg font-bold">買取入力</h1>
      <input className="border p-2 w-full" placeholder="品名" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <input className="border p-2 w-full" placeholder="ブランド" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
      <input className="border p-2 w-full" placeholder="型番" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
      <input className="border p-2 w-full" placeholder="状態" value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} />
      <input className="border p-2 w-full" type="number" inputMode="numeric" placeholder="買取額（円）" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
      <input className="border p-2 w-full" type="file" accept="image/*" capture="environment" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      {msg && <p className="text-red-600">{msg}</p>}
      <button onClick={save} className="bg-black text-white w-full py-3 rounded">保存</button>
    </main>
  );
}
```

- [ ] **Step 2: 回収入力画面**

`app/cases/[id]/collection/page.tsx`:
```tsx
"use client";
import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/liffClient";

export default function CollectionInput({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [form, setForm] = useState({ item_name: "", work_fee: "" });
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string>();

  async function save() {
    const work_fee = parseInt(form.work_fee, 10);
    if (!form.item_name || isNaN(work_fee)) { setMsg("品目と作業費は必須"); return; }
    setMsg("保存中...");
    const r = await apiFetch<{ id: string }>("/api/collection-items", {
      method: "POST", body: JSON.stringify({ case_id: id, item_name: form.item_name, work_fee }),
    });
    if (!r.ok) { setMsg(r.error); return; }
    if (file) {
      const fd = new FormData();
      fd.append("file", file); fd.append("case_id", id); fd.append("kind", "collection"); fd.append("collection_item_id", r.data!.id);
      const m = await apiFetch("/api/media", { method: "POST", body: fd });
      if (!m.ok) { setMsg("明細は保存できたが写真の保存に失敗: " + m.error); return; }
    }
    router.push(`/cases/${id}`);
  }

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-lg font-bold">回収入力</h1>
      <input className="border p-2 w-full" placeholder="回収品目" value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} />
      <input className="border p-2 w-full" type="number" inputMode="numeric" placeholder="作業費（円）" value={form.work_fee} onChange={e => setForm({ ...form, work_fee: e.target.value })} />
      <input className="border p-2 w-full" type="file" accept="image/*" capture="environment" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      {msg && <p className="text-red-600">{msg}</p>}
      <button onClick={save} className="bg-black text-white w-full py-3 rounded">保存</button>
    </main>
  );
}
```

- [ ] **Step 3: ビルド確認 & Commit**

Run: `npm run build`
Expected: 成功。
```bash
git add app/cases/[id]/purchase/page.tsx app/cases/[id]/collection/page.tsx
git commit -m "feat: purchase & collection input screens with photo upload"
```

---

### Task 15: 結線・手動E2E・LIFF設定（受け入れ）

**Files:**
- Create: `docs/RUNBOOK.md`（環境変数・LIFF設定・E2E手順）

**Interfaces:**
- Consumes: 全 Task の成果物。

- [ ] **Step 1: RUNBOOK を書く**

`docs/RUNBOOK.md` に以下を記載:
- `.env.local` に必要な値（Supabase URL / service role key / `NEXT_PUBLIC_LIFF_ID` / `LINE_LOGIN_CHANNEL_ID` / 会社情報4項目）
- LINE Developers で LIFF アプリ作成（endpoint = デプロイURL、scope = profile/openid）、`NEXT_PUBLIC_LIFF_ID` を取得
- 自分の LINE userId を `staff.line_user_id` に登録する手順（初回 `liff.getProfile()` でログ出力 → SQL で UPDATE）
- デプロイ先（Vercel 等）と endpoint 固定運用

- [ ] **Step 2: 全ユニットテストを通す**

Run: `npm run test`
Expected: 全テスト PASS（money / liffAuth / api / pdf font / templates）。

- [ ] **Step 3: 手動E2E（LINE実機）**

LINEアプリで LIFF を開き、spec §1.2 の6ステップを実施:
1. 予約登録（新規顧客＋既存名寄せ警告の両方を確認）
2. 案件一覧に出る
3. 詳細でステータスを visiting→visited に変更
4. 買取入力（写真付き）＋回収入力（写真付き）
5. 買取伝票PDF・領収書PDFを発行し、**画面で日本語が文字化けしていないこと**を目視確認（フォント検証の最終関門）
6. Supabase の `documents` / `media` にレコードと Storage オブジェクトができていることを確認

- [ ] **Step 4: Commit**

```bash
git add docs/RUNBOOK.md
git commit -m "docs: Phase 1 runbook (env, LIFF setup, manual E2E checklist)"
```

---

## 完了の定義（Phase 1）
- 全ユニットテスト PASS（money / liffAuth / api / PDF）
- `npm run build` 成功
- LINE実機で予約→入力→買取伝票・領収書PDF発行が文字化けなく通る
- `documents` / `media` / 各明細テーブルにデータが正しく入る

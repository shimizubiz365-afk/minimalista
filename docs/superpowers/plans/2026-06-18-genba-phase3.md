# GENBA Phase 3 Implementation Plan — 在庫・販売・粗利

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans。checkbox 形式。

**Goal:** 案件の仕入プールから商品を作り（バラ売り/ロット/1点・手動原価）、販売登録で粗利を確定する。

**Architecture:** Phase 1/2 基盤に積む。新テーブル products / product_source_items / sales。商品化画面（プール表示）、在庫一覧、商品詳細＋販売。

**Tech Stack:** Phase 1/2 同一。

## Global Constraints
- 金額 integer・計算は決定論・テスト必須。全DBアクセスAPI経由・`{ok,data?,error?}`・`requireStaff`。
- 按分自動計算しない（手動原価＋プール表示）。原価合計＝仕入合計は強制しない。
- 粗利は販売時の product.cost でスナップショット。

---

### Task 1: マイグレーション0004（products / product_source_items / sales）

**Files:** Create `supabase/migrations/0004_phase3_schema.sql`

- [ ] **Step 1: SQL作成**
```sql
create type product_status as enum ('in_stock','listed','sold');
create type sales_channel  as enum ('ebay','mercari','yahoo','store','other');

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status product_status not null default 'in_stock',
  condition text,
  cost integer not null,
  acquired_case_id uuid references cases(id),
  acquired_customer_id uuid references customers(id),
  acquired_by_staff_id uuid references staff(id),
  created_at timestamptz not null default now(),
  listed_at timestamptz,
  sold_at timestamptz
);
create index idx_products_status on products(status);
create index idx_products_acquired_case on products(acquired_case_id);

create table product_source_items (
  product_id uuid not null references products(id) on delete cascade,
  purchase_item_id uuid not null references purchase_items(id),
  primary key (product_id, purchase_item_id)
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  sale_price integer not null,
  channel sales_channel,
  sold_at date not null,
  gross_profit integer not null,
  created_by uuid references staff(id),
  created_at timestamptz not null default now()
);
create index idx_sales_product on sales(product_id);
```
- [ ] **Step 2: Supabase 適用**（SQLエディタ/MCP）。Expected: 3テーブル + 2enum。
- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/0004_phase3_schema.sql
git commit -m "feat: Phase 3 schema (products, product_source_items, sales)"
```

---

### Task 2: grossProfit / sumCosts（TDD）

**Files:** Modify `lib/money.ts`, `lib/money.test.ts`

**Interfaces:** `grossProfit(salePrice:number, cost:number):number` / `sumCosts(products:{cost:number}[]):number`

- [ ] **Step 1: テスト追記**（import に grossProfit, sumCosts を追加）
```ts
describe("grossProfit", () => {
  it("益は正", () => expect(grossProfit(5000, 3000)).toBe(2000));
  it("損は負", () => expect(grossProfit(1000, 1500)).toBe(-500));
  it("同額0", () => expect(grossProfit(2000, 2000)).toBe(0));
});
describe("sumCosts", () => {
  it("空は0", () => expect(sumCosts([])).toBe(0));
  it("複数", () => expect(sumCosts([{ cost: 4000 }, { cost: 1000 }])).toBe(5000));
});
```
- [ ] **Step 2: 失敗確認** — `npm run test -- lib/money.test.ts` → FAIL
- [ ] **Step 3: 実装追記**
```ts
export function grossProfit(salePrice: number, cost: number): number {
  return salePrice - cost;
}
export function sumCosts(products: { cost: number }[]): number {
  return products.reduce((acc, p) => acc + p.cost, 0);
}
```
- [ ] **Step 4: 通過確認** — `npm run test -- lib/money.test.ts` → PASS（16件）
- [ ] **Step 5: Commit**
```bash
git add lib/money.ts lib/money.test.ts
git commit -m "feat: grossProfit + sumCosts deterministic helpers (TDD)"
```

---

### Task 3: 商品化 API（作成 + 一覧）

**Files:** Create `app/api/products/route.ts`

**Interfaces:**
- `POST /api/products` body `{ case_id, name, cost, condition?, source_purchase_item_ids: string[] }` → `data: { id }`
- `GET /api/products?status=&case_id=` → `data: Product[]`（customer名をネスト）

- [ ] **Step 1: 実装**
```ts
import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const caseId = url.searchParams.get("case_id");
  let q = supabaseAdmin()
    .from("products")
    .select("id,name,status,cost,created_at,acquired_customer:customers!products_acquired_customer_id_fkey(name)")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  if (caseId) q = q.eq("acquired_case_id", caseId);
  const { data, error } = await q;
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const b = await req.json();
  if (!b.case_id || !b.name || typeof b.cost !== "number")
    return fail("case_id / name / cost は必須", 400);
  const sources: string[] = b.source_purchase_item_ids ?? [];
  if (sources.length === 0) return fail("源泉の買取明細を1つ以上選んでください", 400);
  const db = supabaseAdmin();

  // 案件→顧客
  const c = await db.from("cases").select("id, customer_id").eq("id", b.case_id).maybeSingle();
  if (c.error || !c.data) return fail("案件が見つかりません", 404);

  // 源泉先頭明細の担当者
  const firstItem = await db
    .from("purchase_items").select("created_by").eq("id", sources[0]).maybeSingle();
  const acquiredBy = firstItem.data?.created_by ?? guard.staff.id;

  const prod = await db.from("products").insert({
    name: b.name,
    cost: b.cost,
    condition: b.condition ?? null,
    acquired_case_id: b.case_id,
    acquired_customer_id: c.data.customer_id,
    acquired_by_staff_id: acquiredBy,
  }).select("id").single();
  if (prod.error) return fail(prod.error.message, 500);

  const rows = sources.map((pid) => ({ product_id: prod.data.id, purchase_item_id: pid }));
  const link = await db.from("product_source_items").insert(rows);
  if (link.error) return fail(link.error.message, 500);

  return ok({ id: prod.data.id });
}
```
- [ ] **Step 2: ビルド** — `npm run build` → 成功
- [ ] **Step 3: Commit**
```bash
git add app/api/products/route.ts
git commit -m "feat: products API (create from purchase items + list)"
```

---

### Task 4: 商品詳細・更新・販売 API

**Files:** Create `app/api/products/[id]/route.ts`, `app/api/sales/route.ts`

**Interfaces:**
- `GET /api/products/[id]` → `data: { product, sources, sale }`
- `PATCH /api/products/[id]` body `{ name?, cost?, status? }` → `data: { id }`（売却済は cost/name 変更不可）
- `POST /api/sales` body `{ product_id, sale_price, channel, sold_at }` → `data: { id, gross_profit }`

- [ ] **Step 1: 商品詳細・更新 API**

`app/api/products/[id]/route.ts`:
```ts
import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const db = supabaseAdmin();
  const [p, src, sale] = await Promise.all([
    db.from("products").select("*").eq("id", id).maybeSingle(),
    db.from("product_source_items").select("purchase_item_id, purchase_items(name,amount)").eq("product_id", id),
    db.from("sales").select("*").eq("product_id", id).maybeSingle(),
  ]);
  if (p.error || !p.data) return fail("商品が見つかりません", 404);
  return ok({ product: p.data, sources: src.data ?? [], sale: sale.data ?? null });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const { id } = await params;
  const b = await req.json();
  const db = supabaseAdmin();
  const cur = await db.from("products").select("status").eq("id", id).maybeSingle();
  if (cur.error || !cur.data) return fail("商品が見つかりません", 404);

  const patch: Record<string, unknown> = {};
  if (typeof b.name === "string") patch.name = b.name;
  if (typeof b.cost === "number") patch.cost = b.cost;
  if (b.status === "listed") { patch.status = "listed"; patch.listed_at = new Date().toISOString(); }
  if (b.status === "in_stock") patch.status = "in_stock";
  if (cur.data.status === "sold" && ("cost" in patch || "name" in patch))
    return fail("売却済の商品は変更できません", 400);
  if (Object.keys(patch).length === 0) return fail("変更項目がありません", 400);

  const { error } = await db.from("products").update(patch).eq("id", id);
  if (error) return fail(error.message, 500);
  return ok({ id });
}
```

- [ ] **Step 2: 販売 API**

`app/api/sales/route.ts`:
```ts
import { ok, fail, requireStaff } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { grossProfit } from "@/lib/money";

export async function POST(req: Request) {
  const guard = await requireStaff(req);
  if (guard instanceof Response) return guard;
  const b = await req.json();
  if (!b.product_id || typeof b.sale_price !== "number" || !b.sold_at)
    return fail("product_id / sale_price / sold_at は必須", 400);
  const db = supabaseAdmin();

  const p = await db.from("products").select("id,status,cost").eq("id", b.product_id).maybeSingle();
  if (p.error || !p.data) return fail("商品が見つかりません", 404);
  if (p.data.status === "sold") return fail("既に売却済です", 409);

  const gross = grossProfit(b.sale_price, p.data.cost);
  const sale = await db.from("sales").insert({
    product_id: b.product_id,
    sale_price: b.sale_price,
    channel: b.channel ?? null,
    sold_at: b.sold_at,
    gross_profit: gross,
    created_by: guard.staff.id,
  }).select("id").single();
  if (sale.error) return fail(sale.error.message, 500);

  const up = await db.from("products")
    .update({ status: "sold", sold_at: new Date().toISOString() }).eq("id", b.product_id);
  if (up.error) return fail(up.error.message, 500);

  return ok({ id: sale.data.id, gross_profit: gross });
}
```
- [ ] **Step 3: ビルド** — `npm run build` → 成功
- [ ] **Step 4: Commit**
```bash
git add app/api/products/[id] app/api/sales
git commit -m "feat: product detail/update API + sales API (gross profit + mark sold)"
```

---

### Task 5: 商品化画面（案件配下・プール表示）+ 案件詳細導線

**Files:** Create `app/cases/[id]/products/page.tsx`, Modify `app/cases/[id]/page.tsx`

**Interfaces:** Consumes `GET /api/cases/[id]`（buy_total算出用 purchase_items）, `GET /api/products?case_id=`, `POST /api/products`

- [ ] **Step 1: 商品化画面**

`app/cases/[id]/products/page.tsx`:
```tsx
"use client";
import { useEffect, useState, use } from "react";
import { apiFetch } from "@/lib/liffClient";
import { formatYen, sumAmounts, sumCosts } from "@/lib/money";

type PItem = { id: string; name: string; amount: number };
type Detail = { purchase_items: PItem[] };
type Prod = { id: string; name: string; cost: number; status: string };

export default function ProductizePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [items, setItems] = useState<PItem[]>([]);
  const [products, setProducts] = useState<Prod[]>([]);
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [msg, setMsg] = useState<string>();

  async function load() {
    const d = await apiFetch<Detail>(`/api/cases/${id}`);
    if (d.ok) setItems(d.data!.purchase_items);
    const p = await apiFetch<Prod[]>(`/api/products?case_id=${id}`);
    if (p.ok) setProducts(p.data!);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const pool = sumAmounts(items);
  const allocated = sumCosts(products);
  const remaining = pool - allocated;

  function toggle(pid: string) {
    setSel((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : [...s, pid]));
  }
  async function create() {
    const c = parseInt(cost, 10);
    if (!name || isNaN(c)) { setMsg("商品名と原価は必須"); return; }
    if (sel.length === 0) { setMsg("源泉の買取明細を選んでください"); return; }
    const r = await apiFetch<{ id: string }>("/api/products", {
      method: "POST",
      body: JSON.stringify({ case_id: id, name, cost: c, source_purchase_item_ids: sel }),
    });
    if (r.ok) { setName(""); setCost(""); setSel([]); setMsg(undefined); load(); }
    else setMsg(r.error);
  }

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-lg font-bold">商品化</h1>
      <div className="bg-gray-100 rounded p-3 text-sm">
        仕入プール: <b>{formatYen(pool)}</b> ／ 割当済: <b>{formatYen(allocated)}</b> ／ 残:{" "}
        <b className={remaining < 0 ? "text-red-600" : ""}>{formatYen(remaining)}</b>
        {remaining < 0 && <span className="text-red-600">（原価が仕入を超過）</span>}
      </div>

      <section>
        <h2 className="font-bold text-sm">源泉の買取明細（チェックで選択）</h2>
        {items.map((it) => (
          <label key={it.id} className="flex items-center gap-2 py-1 border-b">
            <input type="checkbox" checked={sel.includes(it.id)} onChange={() => toggle(it.id)} />
            <span className="flex-1">{it.name}</span>
            <span>{formatYen(it.amount)}</span>
          </label>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold text-sm">新しい商品</h2>
        <input className="border p-2 w-full" placeholder="商品名（出品名）" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="border p-2 w-full" type="number" inputMode="numeric" placeholder="原価（円）" value={cost} onChange={(e) => setCost(e.target.value)} />
        {msg && <p className="text-red-600">{msg}</p>}
        <button onClick={create} className="bg-black text-white w-full py-2 rounded">この商品を作る</button>
      </section>

      <section>
        <h2 className="font-bold text-sm">作成済みの商品</h2>
        {products.map((p) => (
          <div key={p.id} className="flex justify-between py-1 border-b">
            <span>{p.name}（{p.status}）</span>
            <span>原価 {formatYen(p.cost)}</span>
          </div>
        ))}
        {products.length === 0 && <p className="text-gray-400 py-2">まだありません</p>}
      </section>
    </main>
  );
}
```

- [ ] **Step 2: 案件詳細に「商品化」導線を追加**

`app/cases/[id]/page.tsx` の精算セクションの前あたりに：
```tsx
<section>
  <h2 className="font-bold">在庫化</h2>
  <Link href={`/cases/${id}/products`} className="text-blue-600">この案件を商品化する</Link>
</section>
```

- [ ] **Step 3: ビルド** — `npm run build` → 成功
- [ ] **Step 4: Commit**
```bash
git add app/cases/[id]/products/page.tsx app/cases/[id]/page.tsx
git commit -m "feat: productize screen (pool display) + case detail link"
```

---

### Task 6: 在庫一覧 + 商品詳細・販売画面

**Files:** Create `app/products/page.tsx`, `app/products/[id]/page.tsx`

**Interfaces:** Consumes `GET /api/products?status=`, `GET /api/products/[id]`, `PATCH /api/products/[id]`, `POST /api/sales`

- [ ] **Step 1: 在庫一覧**

`app/products/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/liffClient";
import { formatYen } from "@/lib/money";

type Prod = { id: string; name: string; cost: number; status: string; acquired_customer: { name: string } | null };
const TABS = [["in_stock","在庫"],["listed","出品中"],["sold","売却済"]] as const;

export default function ProductsPage() {
  const [tab, setTab] = useState("in_stock");
  const [rows, setRows] = useState<Prod[]>([]);
  useEffect(() => {
    apiFetch<Prod[]>(`/api/products?status=${tab}`).then((r) => r.ok && setRows(r.data!));
  }, [tab]);
  return (
    <main className="p-4 space-y-4">
      <h1 className="text-lg font-bold">在庫</h1>
      <div className="flex gap-2">
        {TABS.map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={`px-3 py-1 rounded ${tab===v?"bg-black text-white":"bg-gray-200"}`}>{l}</button>
        ))}
      </div>
      <ul className="divide-y">
        {rows.map((p) => (
          <li key={p.id}>
            <Link href={`/products/${p.id}`} className="flex justify-between py-3">
              <span>{p.name}<br /><span className="text-xs text-gray-500">{p.acquired_customer?.name}</span></span>
              <span>原価 {formatYen(p.cost)}</span>
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="py-6 text-gray-400">該当なし</li>}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: 商品詳細・販売登録**

`app/products/[id]/page.tsx`:
```tsx
"use client";
import { useEffect, useState, use } from "react";
import { apiFetch } from "@/lib/liffClient";
import { formatYen, grossProfit } from "@/lib/money";

type Detail = {
  product: { id: string; name: string; cost: number; status: string; condition: string | null };
  sale: { sale_price: number; gross_profit: number; channel: string | null; sold_at: string } | null;
};
const CHANNELS = ["mercari","ebay","yahoo","store","other"];

export default function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Detail>();
  const [price, setPrice] = useState("");
  const [channel, setChannel] = useState("mercari");
  const [soldAt, setSoldAt] = useState("");
  const [msg, setMsg] = useState<string>();

  async function load() {
    const r = await apiFetch<Detail>(`/api/products/${id}`);
    if (r.ok) setD(r.data!); else setMsg(r.error);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function sell() {
    const p = parseInt(price, 10);
    if (isNaN(p) || !soldAt) { setMsg("売値と売却日は必須"); return; }
    setMsg("登録中...");
    const r = await apiFetch<{ gross_profit: number }>("/api/sales", {
      method: "POST",
      body: JSON.stringify({ product_id: id, sale_price: p, channel, sold_at: soldAt }),
    });
    if (r.ok) { setMsg(`販売登録（粗利 ${formatYen(r.data!.gross_profit)}）`); load(); }
    else setMsg(r.error);
  }
  if (!d) return <main className="p-4">{msg ?? "読み込み中..."}</main>;
  const previewGross = price ? grossProfit(parseInt(price, 10) || 0, d.product.cost) : null;

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-lg font-bold">{d.product.name}</h1>
      <p className="text-sm">原価 {formatYen(d.product.cost)}・状態 {d.product.status}</p>

      {d.sale ? (
        <div className="bg-green-50 rounded p-3 text-sm">
          売却済：売値 {formatYen(d.sale.sale_price)}／粗利 <b>{formatYen(d.sale.gross_profit)}</b>（{d.sale.channel}・{d.sale.sold_at}）
        </div>
      ) : (
        <section className="space-y-2">
          <h2 className="font-bold text-sm">販売登録</h2>
          <input className="border p-2 w-full" type="number" inputMode="numeric" placeholder="売値（円）" value={price} onChange={(e) => setPrice(e.target.value)} />
          {previewGross !== null && <p className="text-sm">想定粗利: {formatYen(previewGross)}</p>}
          <select className="border p-2 w-full" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="border p-2 w-full" type="date" value={soldAt} onChange={(e) => setSoldAt(e.target.value)} />
          {msg && <p className="text-red-600">{msg}</p>}
          <button onClick={sell} className="bg-black text-white w-full py-3 rounded">販売を登録</button>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 3: トップに在庫導線を追加（任意）**

`app/page.tsx` に在庫一覧リンクを1つ追加：
```tsx
<Link href="/products" className="block rounded bg-gray-200 text-center py-3">在庫一覧へ</Link>
```

- [ ] **Step 4: ビルド + 全テスト** — `npm run build` 成功 / `npm run test` 全PASS
- [ ] **Step 5: Commit**
```bash
git add app/products app/page.tsx
git commit -m "feat: inventory list + product detail/sale screen"
```

---

### Task 7: RUNBOOK更新 + 手動E2E

**Files:** Modify `docs/RUNBOOK.md`

- [ ] **Step 1: RUNBOOK に Phase 3 追記**（migration 0004 適用、商品化→販売→粗利のE2E手順）
- [ ] **Step 2: 全テスト** — `npm run test` 全PASS
- [ ] **Step 3: 手動E2E（実機）**
  1. まとめ買いした案件を商品化：1明細から複数商品（バラ売り）、複数明細から1商品（ロット）
  2. プール表示（仕入/割当済/残）が正しく動く
  3. 在庫一覧→商品→販売登録→粗利が `売値−原価` で出る
  4. 売却済商品に再度販売 → ブロック
- [ ] **Step 4: Commit**
```bash
git add docs/RUNBOOK.md
git commit -m "docs: RUNBOOK Phase 3 (productize, inventory, sales)"
```

---

## 完了の定義（Phase 3）
- 全ユニットテスト PASS（money: grossProfit/sumCosts 含む）
- `npm run build` 成功
- まとめ買い→バラ売り/ロット→販売→粗利が通る
- プール表示（仕入/割当済/残）が機能

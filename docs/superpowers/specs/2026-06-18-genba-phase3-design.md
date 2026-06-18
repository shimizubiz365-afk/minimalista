# GENBA Phase 3 設計書 — 在庫・販売・粗利

**版**: Phase 3 設計 v1.0
**日付**: 2026-06-18
**前提**: Phase 1（買取/回収/伝票）・Phase 2（本人確認/台帳/精算）完了済み。
**スコープ**: 商品化（products）→ 販売登録（sales）→ 粗利反映

> 事業の肝＝「まとめて安く仕入れて、価値あるものをバラして高く売る」。よって**1仕入→複数商品（バラ売り）**を中核に据える。按分は自動計算せず**手動原価＋プール表示**で扱う。

---

## 1. ゴールと受け入れ基準

### 1.1 ゴール
```
案件の買取明細（仕入プール）→ 商品化（売る単位に組み直す・原価を手動で乗せる）→ 在庫 → 販売登録 → 粗利確定
```

### 1.2 受け入れ基準（E2E）
1. 案件の「商品化」画面で、仕入プール（買取合計）・割当済・残を見ながら商品を作れる
2. 1つの仕入明細から**複数商品**を作れる（バラ売り）／複数明細を**1商品**にまとめられる（ロット）
3. 各商品に名前・原価（手入力）・元の買取明細を紐付けられる
4. 在庫一覧を状態（在庫/出品中/売却済）で見られる
5. 商品に販売登録すると、**粗利 = 売値 − 原価** が自動計算され、商品が売却済になる

### 1.3 非ゴール
- 紹介フィー（Phase 4）、ダッシュボード集計ビュー（Phase 5）、帳簿エクスポート（Phase 6）
- 仕入原価の**自動按分**（手動入力で対応。プール残を表示して支援するのみ）
- 原価合計が仕入合計と一致することの**強制**（不一致は許容＝捨てた分があるため。残は表示のみ）

---

## 2. 中核概念：仕入プールと商品化

- **仕入プール** = 案件の買取明細（purchase_items）合計 = `buy_total`。
- **商品（product）** = 売る単位。1つ以上の買取明細から作られ（`product_source_items` で多対多）、**原価（cost）は手入力**。
- **割当済** = その案件から作られた全商品の `cost` 合計。**残** = `buy_total − 割当済`。
- 1仕入→複数商品（バラ売り）、複数明細→1商品（ロット）、1明細→1商品（1点売り）すべて同じ仕組みで表現。
- 残額が残ってよい（捨てた物）。原価合計＞仕入のときだけ画面で警告（任意・ブロックしない）。

---

## 3. データモデル（Phase 3 追加分・マイグレーション0004）

### 3.1 enum
```sql
product_status as enum ('in_stock','listed','sold')
sales_channel  as enum ('ebay','mercari','yahoo','store','other')
```

### 3.2 products
| 列 | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | 出品名（買取明細から初期化、編集可） |
| status | product_status NOT NULL default 'in_stock' | in_stock / listed / sold |
| condition | text | |
| cost | integer NOT NULL | 仕入原価（手入力・粗利の基点） |
| acquired_case_id | uuid FK→cases | 仕入元案件 |
| acquired_customer_id | uuid FK→customers | 仕入元顧客（denormalized） |
| acquired_by_staff_id | uuid FK→staff | 買取担当者（成績帰属・denormalized） |
| created_at | timestamptz default now() | |
| listed_at | timestamptz | 出品時刻（任意） |
| sold_at | timestamptz | 売却時刻 |

### 3.3 product_source_items（商品↔買取明細）
| 列 | 型 | 備考 |
|---|---|---|
| product_id | uuid FK→products | |
| purchase_item_id | uuid FK→purchase_items | |
| PK | (product_id, purchase_item_id) | 多対多。1明細→複数商品も可 |

### 3.4 sales
| 列 | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| product_id | uuid FK→products NOT NULL | |
| sale_price | integer NOT NULL | 売値 |
| channel | sales_channel | 販路 |
| sold_at | date NOT NULL | |
| gross_profit | integer NOT NULL | `sale_price − product.cost`（確定時に焼き込み） |
| created_by | uuid FK→staff | |
| created_at | timestamptz default now() | |

> `gross_profit` は販売時点の `product.cost` で確定しスナップショット。後から原価を変えても売上記録は不変。

---

## 4. 機能とデータフロー

### 4.1 商品化（`/cases/[id]/products`）
- ヘッダに **仕入プール: ¥buy_total ／ 割当済: ¥Σ(この案件の商品cost) ／ 残: ¥差** を常時表示
- その案件の買取明細リストを表示（チェックで源泉を選ぶ）
- 「＋商品を作る」フォーム：商品名・原価・状態・源泉明細（1つ以上選択）
- 既にこの案件で作った商品の一覧（名前/原価/状態）を表示
- 商品作成時、`acquired_case_id`=この案件 / `acquired_customer_id`=案件の顧客 / `acquired_by_staff_id`=選んだ源泉明細の先頭の `created_by`

**作成フロー** `POST /api/products`:
1. staff検証
2. body `{ case_id, name, cost, condition?, source_purchase_item_ids: string[] }`。`source_purchase_item_ids` は1件以上必須。
3. 案件→顧客id取得。源泉明細の先頭の `created_by` を担当者に。
4. products insert（acquired_* 埋め）→ product_source_items に源泉分を一括insert
5. 返却 `{ id }`

### 4.2 在庫一覧（`/products`）
- `GET /api/products?status=in_stock|listed|sold`（未指定なら全件、新しい順）
- 各行：商品名・原価・状態・仕入元顧客名。タップで商品詳細へ

### 4.3 商品詳細・販売登録（`/products/[id]`）
- `GET /api/products/[id]` → 商品 + 源泉明細 + 既存sale（あれば）
- 状態が `sold` でなければ販売登録フォーム：売値・販路・売却日
- 「出品中にする」ボタン（任意）：`PATCH /api/products/[id] { status:'listed' }`、`listed_at` 設定
- 原価・商品名の編集：`PATCH /api/products/[id] { name?, cost? }`（売却前のみ）

**販売登録** `POST /api/sales`:
1. staff検証
2. body `{ product_id, sale_price, channel, sold_at }`
3. 商品取得。既に sold なら 409。
4. `gross_profit = grossProfit(sale_price, product.cost)`（`lib/money.ts` 決定論）
5. sales insert（gross_profit, created_by）
6. products 更新：`status='sold'`, `sold_at`
7. 返却 `{ id, gross_profit }`

### 4.4 金額ロジック追加（`lib/money.ts`）
- `export function grossProfit(salePrice: number, cost: number): number` = `salePrice - cost`
- `export function sumCosts(products: { cost: number }[]): number`（割当済の集計に使用）
- テスト：粗利（益/損/0）、原価合計（空/複数）

### 4.5 エラー処理
- 源泉明細未選択 → 400
- 売却済商品への再販売 → 409
- 集計/insert失敗 → 500

---

## 5. 設計判断
- **自動按分しない**：手動原価＋プール表示（仕入合計/割当済/残）で支援。按分の唯一解が無いため。
- **原価合計＝仕入合計を強制しない**：捨てた物があるため不一致は正常。残は表示のみ、超過時だけ任意警告。
- **粗利は販売時スナップショット**：後から原価変更しても売上記録は不変。
- **担当者帰属**：商品の `acquired_by_staff_id` は源泉明細の先頭の買取入力者。
- **listed は任意**：在庫(in_stock)→売却(sold) が主線。出品中(listed)は記録したい人向けの中間状態。

---

## 6. テスト方針
1. `grossProfit()` / `sumCosts()` 決定論テスト
2. 商品化API：源泉未選択400、複数源泉での作成（product_source_items 件数一致）、acquired_* 埋まり
3. 販売API：粗利計算、二重販売409、商品が sold になる
4. 手動E2E：1案件まとめ買い→複数商品にバラす→各販売→粗利確認、ロット（複数明細→1商品）も確認

---

## 7. ビルド順（Phase 3 内）
1. マイグレーション0004（enum + products + product_source_items + sales）
2. `lib/money.ts` に grossProfit / sumCosts + テスト
3. 商品化API（POST /api/products, GET 一覧）
4. 商品化画面（`/cases/[id]/products`・プール表示）+ 案件詳細から導線
5. 商品詳細・販売API（GET/PATCH /api/products/[id], POST /api/sales）+ テスト
6. 在庫一覧（`/products`）+ 商品詳細/販売画面（`/products/[id]`）
7. 手動E2E

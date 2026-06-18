# GENBA Phase 4 設計書 — 紹介フィー（TK・アンバサダー）

**版**: Phase 4 設計 v1.0
**日付**: 2026-06-18
**前提**: Phase 1-3 完了済み（買取/回収/伝票・本人確認/台帳/精算・在庫/販売/粗利）。
**スコープ**: TK / アンバサダー / フィー率設定 の管理 ＋ 案件への紐付け ＋ 精算時のフィー自動生成（referral_fees）

> 「案件を紹介してくれたアンバサダー（TK配下 or 直）に、会社が紹介フィーを払う」。会社の支払い先は **直なら本人／TK配下ならTK**、内訳（TK取り分・アンバサダー取り分）は台帳に記録のみ（配分はTKが実施）。

---

## 1. ゴールと受け入れ基準

### 1.1 ゴール
```
TK/アンバサダー/フィー率を登録 → 紹介案件にアンバサダーを紐付け → 精算確定時にフィーを自動計算して台帳(referral_fees)に記録 → 支払い管理（未払い/支払済）
```

### 1.2 受け入れ基準（E2E）
1. TK・アンバサダー・フィー率設定を登録できる
2. 紹介(source=referral)の案件にアンバサダーを紐付けられる
3. その案件を精算確定すると、`referral_fees` が**仕様のロジック通り**に自動生成される（直/TK経由で支払い先と内訳が変わる）
4. フィー台帳を一覧し、未払い→支払済に更新できる
5. 紹介でない案件、またはアンバサダー未紐付けの案件では、フィーは生成されない

### 1.3 非ゴール
- ダッシュボード集計（Phase 5）、帳簿エクスポート（Phase 6）
- アンバサダーへの実支払い処理・送金（記録のみ）
- QR/紹介コードからの自動流入（`route_code` は持つが読み取り経路はPhase外）

---

## 2. データモデル（Phase 4 追加・マイグレーション0005）

### 2.1 enum
```sql
payee_type as enum ('ambassador','tk')   -- 会社の支払い先
fee_status as enum ('accrued','paid')     -- 未払い / 支払済
```

### 2.2 tk（統括）
| 列 | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| contact | text | |
| payment_info | text | 振込先等 |
| active | boolean default true | |
| created_at | timestamptz default now() | |

### 2.3 ambassadors
| 列 | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| route_code | text UNIQUE NOT NULL | QR/流入経路コード |
| tk_id | uuid FK→tk **nullable** | null = 直アンバサダー |
| active | boolean default true | |
| created_at | timestamptz default now() | |

### 2.4 fee_settings（全社フィー率・履歴可）
| 列 | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| rate_buy | numeric NOT NULL | 買取額への料率（例 0.05） |
| rate_work | numeric NOT NULL | 作業費への料率 |
| tk_share | numeric NOT NULL | TK経由時のTC取り分割合（例 0.6） |
| ambassador_share | numeric NOT NULL | 参考値（計算は tk_share から残差で算出。保存のみ） |
| effective_from | date NOT NULL | |
| created_at | timestamptz default now() | |

> **最新の有効行**（`effective_from <= today` で最大）を使う。

### 2.5 referral_fees（フィー台帳）
| 列 | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| case_id | uuid FK→cases NOT NULL | |
| ambassador_id | uuid FK→ambassadors NOT NULL | |
| tk_id | uuid FK→tk nullable | |
| fee_buy | integer NOT NULL | `round(buy_total * rate_buy)` |
| fee_work | integer NOT NULL | `round(work_total * rate_work)` |
| fee_total | integer NOT NULL | `fee_buy + fee_work` |
| pay_to | payee_type NOT NULL | 会社の支払い先：ambassador(直)/tk(経由) |
| pay_to_id | uuid | 支払先ID |
| tk_portion | integer | 内訳・参考（TK取り分） |
| ambassador_portion | integer | 内訳・参考（アンバサダー取り分） |
| status | fee_status NOT NULL default 'accrued' | accrued(未払い)/paid(支払済) |
| accrued_at | timestamptz NOT NULL | |
| paid_at | timestamptz nullable | |

### 2.6 cases の紐付け
`cases.referrer_ambassador_id`（Phase 1 でカラムは存在・未使用）に **FK制約を追加**し（→ambassadors）、UIで紐付けられるようにする。

---

## 3. フィー計算ロジック（決定論・`lib/fee.ts`）

仕様のアルゴリズムをそのまま実装：
```ts
fee_buy   = Math.round(buy_total  * rate_buy)
fee_work  = Math.round(work_total * rate_work)
fee_total = fee_buy + fee_work
if (ambassador.tk_id == null) {           // 直
  pay_to = 'ambassador'; pay_to_id = ambassador.id
  tk_portion = 0; ambassador_portion = fee_total
} else {                                   // TK経由
  pay_to = 'tk'; pay_to_id = ambassador.tk_id
  tk_portion = Math.round(fee_total * tk_share)
  ambassador_portion = fee_total - tk_portion
}
```
- `lib/fee.ts`: `export function computeReferralFee(input: { buyTotal:number; workTotal:number; rateBuy:number; rateWork:number; tkShare:number; ambassadorId:string; ambassadorTkId:string|null }): FeeResult`
- `FeeResult = { fee_buy, fee_work, fee_total, pay_to:'ambassador'|'tk', pay_to_id:string, tk_portion, ambassador_portion }`
- テスト：直（tk_portion=0・全額ambassador）／TK経由（tk_share按分・残差ambassador）／端数（Math.round）

---

## 4. 機能とデータフロー

### 4.1 マスタ管理（簡易CRUD）
- `/settings/tk` — TK 一覧＋追加（name/contact/payment_info）
- `/settings/ambassadors` — アンバサダー一覧＋追加（name/route_code/tk選択 or 直）
- `/settings/fees` — フィー率の現行表示＋新しい率を追加（effective_from）
- API: `GET/POST /api/tk`, `GET/POST /api/ambassadors`, `GET/POST /api/fee-settings`

### 4.2 案件へのアンバサダー紐付け
- 予約登録（`/cases/new`）で source=referral を選ぶと**アンバサダー選択**を表示
- 案件作成APIに `referrer_ambassador_id` を受け取り保存（既存 `POST /api/cases` を拡張）
- 案件詳細にも紹介元を表示（編集は最小：紹介元の表示のみ。変更は予約登録時に）

### 4.3 精算時のフィー自動生成（既存精算APIを拡張）
`POST /api/settlements` の処理末尾（case close の前）に追加：
1. 案件に `referrer_ambassador_id` があるか確認。無ければスキップ。
2. 既に当該案件の referral_fees があればスキップ（二重生成防止。settlements自体が二重確定不可なので通常起きない）。
3. 現行 fee_settings（`effective_from <= today` で最大）を取得。無ければフィー生成スキップ（設定未登録）。
4. アンバサダー（tk_id 含む）取得。
5. `computeReferralFee(...)` でフィー算出。
6. referral_fees insert（status=accrued, accrued_at=now）。
7. settlements の返却に `referral_fee_total`（生成時）を含める。

> buy_total/work_total は精算で確定済みの値を使う。フィーは精算と同じ確定タイミングで一度だけ生成。

### 4.4 フィー台帳・支払い管理（`/fees`）
- `GET /api/referral-fees?status=accrued|paid` → 一覧（案件/アンバサダー/TK/金額/状態）
- 各行「支払済にする」→ `PATCH /api/referral-fees/[id] { status:'paid' }`（paid_at=now）
- 集計表示（未払い合計）は画面側で算出

### 4.5 エラー処理
- route_code 重複 → 400/409（UNIQUE違反）
- フィー率未登録での精算 → フィー生成スキップ（精算自体は成功・メッセージで通知）
- 必須項目欠落 → 400

---

## 5. 設計判断
- **フィー生成は精算時に1回**：buy_total/work_total が確定する精算と同タイミング。冪等（既存があればスキップ）。
- **会社の支払い先は pay_to/pay_to_id に一本化**：直=ambassador、TK経由=tk。内訳(tk_portion/ambassador_portion)は記録のみ。
- **ambassador_share は保存のみ・計算に使わない**：計算は tk_share と残差（仕様アルゴリズム準拠）。混乱回避のためUIで「参考値」と明記。
- **率は履歴を残す**：fee_settings は追記式、現行＝effective_from最大。過去案件のフィーは生成時点の率で確定済み（再計算しない）。
- **実支払いは記録のみ**：送金処理は範囲外。accrued→paid の状態管理まで。

---

## 6. テスト方針
1. `computeReferralFee()` 決定論テスト：直/TK経由/端数（Math.round）/作業費0
2. フィー生成（精算API拡張）：紹介案件→生成、非紹介→非生成、率未登録→スキップ
3. 台帳：accrued→paid 更新
4. 手動E2E：TK・直それぞれのアンバサダー紹介案件で精算→フィー台帳に正しい支払い先・内訳

---

## 7. ビルド順（Phase 4 内）
1. マイグレーション0005（enum + tk + ambassadors + fee_settings + referral_fees + cases FK）
2. `lib/fee.ts` computeReferralFee + テスト
3. マスタ API（tk / ambassadors / fee-settings）
4. マスタ画面（/settings/*）
5. 予約登録に紹介元アンバサダー選択を追加（cases API 拡張）
6. 精算API拡張（フィー自動生成）+ テスト
7. フィー台帳 API + 画面（/fees, 支払済更新）
8. 手動E2E

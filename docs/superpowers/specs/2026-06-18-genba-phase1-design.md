# GENBA（仮称）出張買取 業務システム — Phase 1 設計書

**版**: Phase 1 設計 v1.0
**日付**: 2026-06-18
**対象**: 単一テナント（自社専用）出張買取の業務管理ツール
**配信形態**: LINE内 LIFFアプリ（リッチメニューから起動）
**スコープ**: Phase 1 — 中核ループのみ（予約登録 → 案件一覧 → 案件詳細 → 買取入力 → 買取伝票PDF発行 → 表示・保存）

> 本設計書はマスター仕様 v0.2（全6フェーズ）のうち **Phase 1 のみ** を対象とする。Phase 2-6（回収・台帳・精算・在庫・販売・紹介フィー・ダッシュボード・帳簿エクスポート）は完成形ロードマップとして別途扱い、Phase 1 を E2E で通してから各フェーズを個別にブレスト→設計→実装する。

---

## 1. ゴールと受け入れ基準

### 1.1 Phase 1 のゴール
出張買取の中核業務フローを LINE 内で1本通す：

```
予約登録 → 案件一覧 → 案件詳細 → 買取入力（写真付き）→ 買取伝票PDF発行 → 画面表示・保存
```

### 1.2 受け入れ基準（E2E）
LINEアプリ実機で、スタッフがログインして以下を完遂できること：
1. 電話で受けた依頼を **予約登録**（既存顧客は名寄せ候補から選択、新規は作成）
2. **案件一覧** で予約案件を確認
3. **案件詳細** を開き、ステータスを進められる（reserved→visiting→visited）
4. **買取入力** で複数の買取明細を金額・写真付きで登録
5. **買取伝票PDF** を発行し、画面に日本語が正しく表示される PDF が出る
6. 発行された PDF が Supabase Storage に保存され、`documents` に記録される

### 1.3 非ゴール（Phase 1で作らない）
- 回収・古物台帳・精算・在庫・販売・紹介フィー・ダッシュボード（Phase 2以降）
- 顧客への実送信（LINE/メール）— `documents.sent_*` は箱だけ用意し未実装
- 帳簿エクスポート
- RLS（単一テナント内部ツールのため当面サーバー側でゲート。SaaS化時の既知移行ポイント）

---

## 2. アーキテクチャ

### 2.1 全体構成
```
LINEアプリ ──(リッチメニュー)──▶ LIFFエンドポイント = Next.js アプリ (単一)
   画面(client component)  ──fetch──▶  Next.js API routes (server)
                                          │ ① LIFF IDトークン検証
                                          │ ② staff 突合 (line_user_id)
                                          │ ③ Supabase (service role) で読み書き
                                          │ ④ PDF生成 → Storage保存
                                          ▼
                                       Supabase (Postgres + Storage)
```

**原則**: クライアントから Supabase を直接叩かない。すべて Next.js API routes 経由。`service_role` キーはサーバーのみが保持し、クライアントには露出しない。

### 2.2 技術スタック
- Next.js 16 (App Router) + TypeScript（既存 hospitality-site と統一）
- Tailwind CSS v4
- Supabase: Postgres（DB）/ Storage（画像・PDF）/ Auth は不使用
- LIFF SDK（@line/liff）— クライアント側ログイン＋IDトークン取得
- PDF: `@react-pdf/renderer`（サーバー側生成、Noto Sans JP 埋め込み）

### 2.3 認証（判断点①の決定 = 案A）
- クライアント: LIFF初期化 → `liff.login()` → IDトークン取得
- サーバー: API route が IDトークンを LINE の検証エンドポイントで検証 → `sub`（LINE userId）を取得 → `staff.line_user_id` で突合
- staff が見つからない / `active=false` → 「管理者に連絡してください」表示、全API拒否
- Supabase Auth は使わない。RLS は当面オフ（サーバーがゲート）。SaaS化時に `tenant_id` + RLS 追加が既知移行ポイント。

### 2.4 ディレクトリ構成（想定）
```
app/
  layout.tsx, globals.css
  (liff)/                  # LIFF配信ページ群
    page.tsx               # 起動・ログイン・案件一覧へ
    cases/page.tsx         # 01 案件一覧
    cases/new/page.tsx     # 02 予約登録
    cases/[id]/page.tsx    # 03 案件詳細
    cases/[id]/purchase/page.tsx  # 04 買取入力
  api/
    auth/verify/route.ts   # IDトークン検証+staff突合
    customers/search/route.ts     # 電話名寄せ候補
    cases/route.ts                # 一覧/作成
    cases/[id]/route.ts           # 詳細/ステータス更新
    purchase-items/route.ts       # 買取明細 作成
    media/route.ts                # 画像アップロード
    documents/purchase-slip/route.ts  # 買取伝票PDF発行
lib/
  supabaseAdmin.ts         # service role クライアント（サーバー専用）
  liffAuth.ts              # IDトークン検証 + staff突合
  company.ts               # 会社情報（屋号/古物商許可番号/住所/TEL）定数
  money.ts                 # 金額の決定論ロジック（集計）
  pdf/purchaseSlip.tsx     # 買取伝票テンプレート（react-pdf）
```

---

## 3. データモデル（Phase 1）

### 3.1 enum
```sql
case_status : reserved | visiting | visited | pending_pickup | closed | cancelled
lead_source : phone | line | email | referral
media_kind  : purchase | collection | id_doc
doc_type    : purchase_slip | receipt
```
Phase 1 で実際に使う遷移は `reserved → visiting → visited → closed`（＋`cancelled`）。`pending_pickup` は定義のみ。`media_kind` は `purchase` を主に使用。`doc_type` は `purchase_slip` のみ。

### 3.2 テーブル

**staff**
| 列 | 型 | 備考 |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| line_user_id | text UNIQUE | **突合キー**。index |
| auth_user_id | uuid nullable | 将来用 |
| name | text NOT NULL | |
| active | boolean default true | |
| created_at | timestamptz default now() | |

**customers**
| 列 | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| customer_no | text UNIQUE NOT NULL | `C-000001` 形式。シーケンス＋トリガで採番 |
| name | text NOT NULL | |
| name_kana | text | |
| phone | text | **名寄せキー**。index。重複許容（UNIQUEにしない） |
| address | text | |
| created_at | timestamptz default now() | |

**cases**
| 列 | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| customer_id | uuid FK→customers NOT NULL | |
| status | case_status NOT NULL default 'reserved' | |
| visit_at | timestamptz | 予約日時 |
| area | text | |
| desired_items | text | 希望品目 |
| source | lead_source NOT NULL | |
| referrer_ambassador_id | uuid nullable | Phase 1未使用（FKはPhase 4で付与）|
| registered_by | uuid FK→staff | クロージング＝登録者 |
| assigned_to | uuid FK→staff nullable | 担当者（任意） |
| memo | text | |
| created_at | timestamptz default now() | |
| closed_at | timestamptz | |

**call_logs**
| 列 | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| case_id | uuid FK→cases NOT NULL | |
| called_at | timestamptz NOT NULL | |
| result_memo | text | |
| created_by | uuid FK→staff | |
| created_at | timestamptz default now() | |

**purchase_items（買取明細）**
| 列 | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| case_id | uuid FK→cases NOT NULL | |
| name | text NOT NULL | 品名 |
| brand | text | |
| model | text | |
| condition | text | |
| amount | integer NOT NULL | 買取額（円） |
| created_by | uuid FK→staff | 買取入力者（成績の基点） |
| created_at | timestamptz default now() | |

**media（写真）**
| 列 | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| case_id | uuid FK→cases NOT NULL | |
| kind | media_kind NOT NULL | Phase 1は主に `purchase` |
| purchase_item_id | uuid FK→purchase_items nullable | |
| collection_item_id | uuid nullable | Phase 1未使用 |
| storage_path | text NOT NULL | Supabase Storage パス |
| created_at | timestamptz default now() | |

**documents（発行物PDF）**
| 列 | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| case_id | uuid FK→cases NOT NULL | |
| type | doc_type NOT NULL | Phase 1は `purchase_slip` |
| storage_path | text NOT NULL | |
| issued_at | timestamptz default now() | |
| sent_at | timestamptz nullable | Phase 1未使用 |
| sent_method | text nullable | Phase 1未使用 |

### 3.3 採番（customer_no）
Postgres シーケンス `customer_no_seq` ＋ BEFORE INSERT トリガで `'C-' || lpad(nextval::text, 6, '0')` を生成。

### 3.4 会社情報（テーブルにしない）
屋号・古物商許可番号・住所・TEL は `lib/company.ts` の定数（または `.env`）として保持し、買取伝票PDFが参照。Phase 1 では編集UIを作らない。

### 3.5 Storage バケット
- `media`（買取品写真）/ `documents`（PDF）。非公開バケットとし、署名URLで配信。

---

## 4. 画面とデータフロー

| # | 画面 | パス | 操作 | 書き込み |
|---|---|---|---|---|
| 起動 | ログイン | `/` | LIFF初期化→ログイン→staff突合。未登録は連絡案内 | — |
| 01 | 案件一覧 | `/cases` | status別タブ、新規予約ボタン | 読 |
| 02 | 予約登録 | `/cases/new` | 電話入力→既存候補警告→選択or新規、訪問日時/エリア/希望品目/source | customers(新規時) + cases |
| 03 | 案件詳細 | `/cases/[id]` | 顧客情報・架電ログ・買取明細・ステータス変更・伝票発行 | call_logs / cases.status |
| 04 | 買取入力 | `/cases/[id]/purchase` | 明細を複数追加（品名/ブランド/型番/状態/金額）、各明細に写真添付 | purchase_items + media |
| 05 | 伝票発行 | 案件詳細内アクション | 「買取伝票PDF発行」→生成→画面にPDF表示 | documents |

### 4.1 名寄せフロー（予約登録）
電話番号入力 → `GET /api/customers/search?phone=` で同一/類似phoneの既存顧客を返す → 候補があれば「既存顧客が見つかりました」と警告表示し選択可能 → 選択しなければ新規 customer 作成。phone は重複許容（家族別案件を想定）。

### 4.2 伝票発行フロー
1. クライアント「発行」→ `POST /api/documents/purchase-slip { case_id }`
2. API: staff検証 → 当該 case の purchase_items を取得 → `lib/money.ts` で合計を決定論的に集計
3. `lib/pdf/purchaseSlip.tsx`（react-pdf）で PDF 生成（会社情報 + 顧客 + 明細 + 合計 + 取引日 + 担当者）
4. Storage `documents` バケットへ保存
5. `documents` 行 insert（type=`purchase_slip`, storage_path）
6. 署名URLを返却 → クライアントで PDF 表示

### 4.3 画像アップロード
`<input type="file" accept="image/*" capture="environment">` で撮影/選択 → `POST /api/media`（multipart）→ サーバーが Storage `media` へ保存 → `media` 行 insert（purchase_item_id 紐付け）。

### 4.4 エラー処理
全 API route は `{ ok: boolean, data?, error? }` 形式で返す。画面側で以下を明示：
- LIFFログイン失敗 / staff未登録・無効
- 顧客検索失敗 / 案件作成失敗
- 画像アップロード失敗（再試行可）
- PDF生成失敗

---

## 5. 金額の扱い（決定論）
- 金額はすべて `integer`（円・最小単位）。浮動小数を使わない。
- 買取合計 = `sum(purchase_items.amount)` を `lib/money.ts` の純関数で算出。AIを介在させない。
- 税の扱いは Phase 1 では対象外（後フェーズ）。

---

## 6. テスト方針
1. **決定論ロジック（最優先）**: `lib/money.ts` の合計算出 → ユニットテスト（空・1件・複数・大きい額）。
2. **PDF生成**: 日本語フォント埋め込みの検証を最初に単体で潰す（「日本語が出るPDFを1枚生成」を最初のタスクにする）。買取伝票テンプレートの項目が揃うことをテスト。
3. **API routes**: staff検証（正常/未登録/無効）、明細集計、ステータス更新の境界。
4. **手動E2E**: LINE実機で §1.2 の6ステップを通すのが受け入れ基準。

---

## 7. 既知のリスク・要確認
1. **LIFF ログイン更新 / URL固定運用**: LIFFエンドポイントURLは固定にし、デプロイ毎にLINE Developers側を更新しない運用（裏でデプロイ）。
2. **LINE内ブラウザのカメラ**: `<input capture>` の挙動は端末差あり。実機検証を早めに。
3. **PDF日本語フォント**: react-pdf に Noto Sans JP を `Font.register` で埋め込む。これが Phase 1 最大の技術的罠。
4. **古物台帳の法定項目**: Phase 1 では台帳テーブルを作らない（Phase 2）。買取伝票の記載項目も、Phase 2 の古物営業法一次確認時に整合を取る。Phase 1 の伝票は標準的な買取控え項目で用意する。
5. **会社情報の値**: 屋号・古物商許可番号・住所・TEL の実値は実装時に Shun から受領（`lib/company.ts` / `.env` に投入）。

---

## 8. ビルド順（Phase 1 内）
1. 足場: Next.js + Supabase client(server) + LIFF初期化 + Storageバケット作成
2. DBマイグレーション（enum + 7テーブル + 採番トリガ）
3. 認証: IDトークン検証 + staff突合（`lib/liffAuth.ts`）
4. PDF日本語フォント単体検証（最大の罠を先に潰す）
5. 予約登録 + 名寄せ（02）→ 案件一覧（01）
6. 案件詳細（03）+ ステータス更新
7. 買取入力（04）+ 画像アップロード
8. 買取伝票PDF発行（05）
9. 手動E2E（実機）

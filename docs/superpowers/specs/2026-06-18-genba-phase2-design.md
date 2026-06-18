# GENBA Phase 2 設計書 — 本人確認・古物台帳・精算

**版**: Phase 2 設計 v1.0
**日付**: 2026-06-18
**前提**: Phase 1（予約→案件→買取/回収入力→買取伝票/領収書PDF）完了済み。本設計はその上に積む。
**スコープ**: 本人確認（06）→ 古物台帳（08）→ 精算（07）

> 回収・領収書は Phase 1 で実装済み。Phase 2 は法定記録（古物台帳）と案件の金銭確定（精算）を担う。

---

## 1. ゴールと受け入れ基準

### 1.1 ゴール
買取を伴う案件を法的・会計的に確定できるようにする：
```
本人確認（身分証＋職業・年齢）→ 精算確定（買取・回収の金額確定）→ 古物台帳の自動生成 → 案件クローズ
```

### 1.2 受け入れ基準（E2E）
1. 案件詳細から **本人確認** を実施：身分証を撮影、確認方法・相手方の職業・年齢を記録できる
2. **精算確定** を実行：買取合計・作業費合計・差引・受領/支払現金を確定し `settlements` に保存
3. 精算確定と同時に、買取明細から **古物台帳** が法定5項目を満たして自動生成される
4. 精算確定で案件が `closed` になる
5. 買取明細があるのに本人確認が未済の場合、精算確定は **ブロック** され明示メッセージが出る

### 1.3 非ゴール
- 在庫・販売（Phase 3）、紹介フィー（Phase 4）、ダッシュボード（Phase 5）、帳簿エクスポート（Phase 6）
- 1万円未満の記録義務免除ロジック（後述 §5 の判断により**実装しない**＝全件記録）

---

## 2. 法的根拠（古物営業法）

帳簿（古物台帳）の法定記録事項（買取＝古物の受取時）は5項目：
1. 取引の年月日
2. 古物の品目及び数量
3. 古物の特徴
4. 相手方の住所・氏名・職業・年齢
5. 相手方の身分を確認した方法

- 保管期間：最終記載日から **3年間**
- 電磁的記録で可（本システム＝電磁的記録）
- 対象は買取（古物の受取）。**回収は古物の買取でないため台帳対象外**
- 1万円未満は原則記録免除（例外品目あり）だが、本システムは**全件記録**して安全側に倒す（免除/例外判定は実装しない）

出典: 警視庁「帳簿の様式」、古物営業法(e-Gov 324AC0000000108)、古物商の取引記録義務解説。

---

## 3. データモデル（Phase 2 追加分）

### 3.1 customers への列追加（マイグレーション0003）
- `occupation` text nullable — 職業（法定項目・本人確認時に入力、再利用のため顧客に保存）
- `birth_year` integer nullable — 生年（年齢算出用。年齢を直接持つと毎年ズレるため生年で保持し表示時に算出）

> 年齢の法定記録は「取引時点の年齢」。台帳には取引時点で算出した `customer_age` を**スナップショット**で焼き込む（§3.3）。

### 3.2 settlements（精算）
| 列 | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| case_id | uuid FK→cases **UNIQUE** NOT NULL | 案件1件＝精算1件 |
| buy_total | integer NOT NULL | 買取合計（purchase_items 集計） |
| work_total | integer NOT NULL | 作業費合計（collection_items 集計） |
| net_amount | integer NOT NULL | `buy_total - work_total`（正=うちが支払い超過 / 負=受領超過） |
| cash_settled | integer NOT NULL | 実際に動いた現金（手入力・端数/値引き吸収・帳簿の基点） |
| settled_at | timestamptz NOT NULL | |
| settled_by | uuid FK→staff | |

### 3.3 kobutsu_daicho（古物台帳・法定）
| 列 | 型 | 法定項目 | 備考 |
|---|---|---|---|
| id | uuid PK | | |
| case_id | uuid FK→cases NOT NULL | | |
| purchase_item_id | uuid FK→purchase_items NOT NULL | | 買取明細1件＝台帳1行 |
| transaction_date | date NOT NULL | ①取引年月日 | |
| item_description | text NOT NULL | ②品目 | 品名+ブランド+型番から生成 |
| quantity | integer NOT NULL default 1 | ②数量 | |
| item_characteristics | text | ③特徴 | condition等から生成（追加列） |
| price | integer NOT NULL | 代価 | 買取額 |
| customer_name | text NOT NULL | ④氏名 | スナップショット |
| customer_address | text NOT NULL | ④住所 | スナップショット |
| customer_occupation | text NOT NULL | ④職業 | スナップショット（追加） |
| customer_age | integer NOT NULL | ④年齢 | 取引時点の算出値スナップショット（追加） |
| verification_method | text NOT NULL | ⑤確認方法 | 身分証種別 |
| id_media_id | uuid FK→media | | 身分証写真 |
| created_at | timestamptz default now() | | |

> スナップショット理由：顧客情報が後で変わっても、取引時点の法定記録は不変でなければならない。

---

## 4. 機能とデータフロー

### 4.1 本人確認（06）
- 案件詳細に「本人確認」セクション/ボタン → 専用画面 `/cases/[id]/verify`
- 入力：`verification_method`（運転免許証/マイナンバーカード/在留カード/パスポート/その他のセレクト）、職業、生年（西暦）
- 身分証写真を撮影 → `POST /api/media`（kind=`id_doc`）
- 確認情報の保存先：`customers.occupation` / `customers.birth_year` を更新（再利用）。`verification_method` と `id_media_id` は精算時に台帳へ焼く必要があるため、**案件に紐づく一時保持**が要る → `cases` に `verification_method` text / `id_media_id` uuid を追加（マイグレーション0003）。
- 完了で案件詳細に「本人確認済み（確認方法・身分証写真）」を表示

### 4.2 精算確定（07）
`POST /api/settlements { case_id, cash_settled }`:
1. staff検証
2. 既に settlements が存在すれば 409（二重確定防止）
3. 買取明細が1件以上あるなら、**本人確認の完了を必須チェック**（`cases.verification_method` と `id_media_id` と `customers.occupation`/`birth_year` が揃っていること）。未済なら 400「本人確認が未完了です」
4. `buy_total = sumAmounts(purchase_items)`、`work_total = sumWorkFees(collection_items)`、`net_amount = netAmount(buy_total, work_total)`（`lib/money.ts` 決定論）
5. settlements insert
6. 各 purchase_item から kobutsu_daicho を一括生成（取引時点の年齢 = 当年 − birth_year をスナップショット）
7. `cases.status = closed`, `closed_at = now()`
8. 返却：精算サマリ（buy/work/net/cash）

> 買取明細が0件（回収のみの案件）の場合は本人確認・台帳生成をスキップし、settlements（buy_total=0）のみ作成して closed にできる。

### 4.3 金額ロジック追加（`lib/money.ts`）
- `export function netAmount(buyTotal: number, workTotal: number): number` = `buyTotal - workTotal`
- ユニットテスト：買取超過（正）・受領超過（負）・同額（0）

### 4.4 エラー処理
- 二重精算 → 409
- 本人確認未済での精算 → 400 明示
- 集計/insert失敗 → 500（`{ok:false,error}`）

---

## 5. 設計判断

- **1万円未満免除・例外品目は実装しない**：全件記録が安全側。免除判定の誤りは法令違反リスクなので、過剰記録（無害）を選ぶ。
- **台帳生成は精算時にまとめて**：買取入力の都度でなく、本人確認が揃う精算時に生成すれば法定項目が必ず埋まる。
- **年齢は生年で保持しスナップショット**：顧客マスタは生年、台帳は取引時点年齢を固定。
- **本人確認情報の保持場所**：職業/生年は顧客（再利用）、確認方法/身分証写真は案件（その取引固有）。

---

## 6. テスト方針
1. `netAmount()` 決定論テスト（正/負/0）
2. 精算API：二重確定409、本人確認未済400、正常時の settlements + kobutsu_daicho 生成（買取明細数と台帳行数の一致）、回収のみ案件の扱い
3. 台帳スナップショット：精算後に顧客名を変えても台帳の customer_name が不変
4. 手動E2E：本人確認→精算確定→台帳生成→クローズを実機で1本

---

## 7. ビルド順（Phase 2 内）
1. マイグレーション0003（customers列追加 / cases列追加 / settlements / kobutsu_daicho）
2. `lib/money.ts` に netAmount + テスト
3. 本人確認 API（cases の verification 更新 + customers の occupation/birth_year 更新）
4. 本人確認 画面 `/cases/[id]/verify`
5. 精算 API（settlements + kobutsu_daicho 生成 + close）+ テスト
6. 案件詳細に本人確認状態・精算確定UI を追加
7. 手動E2E

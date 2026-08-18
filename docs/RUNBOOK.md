# GENBA Phase 1 RUNBOOK

Phase 1（出張買取 LIFFアプリ）を実際に動かすための手順。コードはすべて実装済み・ユニットテスト16件PASS・`npm run build` 成功。残るは**外部サービスの接続**と**実機E2E**。

## 1. 必要な外部サービス

### 1.1 Supabase
1. Supabase プロジェクトを作成（または既存を使用）。
2. SQL エディタで以下を順に実行：
   - `supabase/migrations/0001_phase1_schema.sql`
   - `supabase/migrations/0002_storage_buckets.sql`
3. プロジェクト設定から取得：
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`（**秘匿。クライアントに出さない**）

### 1.2 LINE（LIFF）
1. LINE Developers コンソールで Provider → **LINE Login チャネル** を作成。
2. チャネルID → `LINE_LOGIN_CHANNEL_ID`
3. そのチャネルに **LIFF アプリ** を追加：
   - Endpoint URL = デプロイ先URL（例 `https://genba.vercel.app`）
   - Scope = `profile`, `openid`
   - LIFF ID → `NEXT_PUBLIC_LIFF_ID`
4. デプロイ毎にURLが変わらないよう **Endpoint URL は固定** にし、裏でデプロイする運用にする。

## 2. 環境変数

`.env.local`（`.env.local.example` をコピーして埋める）:
```
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_LIFF_ID=...
LINE_LOGIN_CHANNEL_ID=...
COMPANY_NAME=ミニマリスタ
COMPANY_KOBUTSU_LICENSE=（古物商許可番号）
COMPANY_ADDRESS=（住所）
COMPANY_TEL=（電話）
```
※ `COMPANY_*` は買取伝票・領収書PDFに印字される。未設定なら「未設定」と出る。

## 3. スタッフ登録（従業員を増やす）

**アプリ内で完結する。SQLは不要**（2026-08-18〜）。

1. 追加したい従業員に **LIFFのURLをLINEで送る**（Endpoint URL と同じ）。
2. 本人が開くと「はじめての利用登録」画面が出る → **「利用を申請する」**をタップ。
   - この時点で `staff` 行が `active=false` で作られる。まだ何のAPIも通らない。
3. 既存スタッフが **設定 → 「承認待ちのスタッフ」** で **承認する** をタップ。
4. 本人が「承認されたか確認する」を押すと通常画面に入れる。
5. 表示名（書類の「担当」欄に出る）は **設定 → あなたのアカウント** で本人が変更できる。

※ 承認前は全APIが401なので、URLを知る第三者が申請しても実害は「承認待ちの行が1件増える」だけ。
※ 一番最初の1人だけはSQLで作る必要がある（承認する人がいないため）:
```sql
update staff set line_user_id = 'Uxxxxxxxx...' where name = 'Shun';
```

## 4. デプロイ

**GitHub連携は入っていない。push しても本番は変わらない。**
本番はこのマシンから Vercel CLI で直接デプロイする。

```bash
vercel login          # トークンは切れるので都度（対話式）
vercel --prod --yes   # project-b3jrn.vercel.app に反映
```

反映確認（新ルートが 404 でなくなるかを見る）:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://project-b3jrn.vercel.app/api/staff/register  # 401ならOK
```

- 環境変数は Vercel 側にも登録が要る（`vercel env ls production` で確認）。`.env.local` に足したら本番にも足す。
- LIFF の Endpoint URL は `https://project-b3jrn.vercel.app` 固定。デプロイしてもURLは変わらない。
- `@react-pdf/renderer` はサーバー（Node ランタイム）で動く。API route はデフォルトで Node 実行。
- フォント `public/fonts/NotoSansJP-Regular.ttf` はリポジトリに含まれている（`process.cwd()/public/fonts` から読む）。

### Supabase（無料プラン）の注意
7日間アクセスが無いとプロジェクトが自動で一時停止し、**DNSごと引けなくなる**（＝全機能が落ちる）。
復帰は Studio の Restore。実運用に入るなら Pro（$25/月）にすると停止しなくなる。

## 4a. 本番スキーマのズレ（migrations と一致していない箇所）

Phase1 のテーブル群は 0001 の定義とは別の手順で作られており、以下がズレている。
**コード側は全て回避済み**なので実害は無いが、DDLを流す前に必ずこれを思い出すこと。

| 箇所 | migrations の定義 | 本番の実態 |
|---|---|---|
| `cases.status` | `case_status` enum | **text**（enum型は存在しない） |
| `documents.type` | `doc_type` enum | **text** |
| `documents` | `issued_at` / `sent_at` / `sent_method` | 無い。代わりに `created_at` |
| `media` | `purchase_item_id` / `collection_item_id` | 無い（Driveが正本なので紐付けは省略） |

確認方法（列の型と enum はここに出る）:
```bash
curl -s -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "$SUPABASE_URL/rest/v1/" | jq '.definitions.cases.properties.status'
```

## 4b. 宿題（実顧客データを入れる前にやること）

- [ ] **スタッフの権限分離**（現状は有効なスタッフ全員がフラット＝誰でも他人を承認でき、フィー率・フィー台帳・粗利・原価が見える）。
      `staff` に role 列を足して admin / staff を分ける。2026-08-18 時点では少人数のため意図的に未実装。
- [ ] 予約リード取込の自動化（現在はホームの手動ボタンのみ）
- [ ] 顧客コード体系（設計は `T01-A03-屋号-0001` / `D-0001`、実装は `C-000001`。第4歩が未着手）

## 5. 手動E2E（受け入れ基準）

LINEアプリで LIFF を開き、以下を確認：
1. **予約登録**：電話番号入力→検索で既存顧客候補が出る（無ければ新規）。新規顧客＋既存名寄せの両方を試す。
2. **案件一覧**：予約タブに出る。
3. **案件詳細**：ステータスを `visiting` → `visited` に変更できる。
4. **買取入力**：品名・金額・写真で明細を複数追加。**回収入力**：品目・作業費・写真で明細を追加。
5. **PDF発行**：買取伝票・領収書を発行し、画面で開いて
   - **日本語が文字化けしていないこと**（フォント検証の最終関門）
   - 金額・合計・会社情報が正しいこと
6. **Supabase 確認**：`documents` / `media` にレコードが入り、Storage の `documents` / `media` バケットにファイルがある。

## 6. ローカル開発

```bash
npm install
npm run test     # ユニットテスト（Supabase/LINE不要）
npm run dev      # ローカル起動（LIFFはモバイル実機 or LIFF Inspectorで確認）
npm run build    # 本番ビルド
```
※ LIFF は LINE アプリ内 or LIFF ブラウザでないとログインが完結しない。ローカルの素のブラウザでは認証部分は通らない。

## 6b. Phase 2（本人確認・古物台帳・精算）

### マイグレーション
- `supabase/migrations/0003_phase2_schema.sql` を適用（customers/cases 列追加 + settlements + kobutsu_daicho）。

### ★ 古物台帳の自動記帳は現在オフ（2026-08-18〜）
運用を優先し、精算時の `kobutsu_daicho` 生成を止めた。テーブル・既存行・組み立てロジック
（`lib/settlement.ts` の `buildDaichoRows`）は温存してあるので、**買取明細＋顧客情報＋本人確認記録から
後でまとめて再生成できる**。古物営業法の帳簿義務（3年保存）は残るため、記帳を再開する判断は別途行うこと。

### E2E（実機）
1. 買取明細のある案件で「本人確認を実施」→ 身分証撮影＋確認方法＋職業＋生年を保存（記録は継続）。
2. 「精算を確定」（受領/支払現金を入力）→ settlements 作成・案件が closed。本人確認の有無で止まらない。
3. 回収のみの案件も同様に精算できる。

### 古物台帳の確認（既存行がある場合）
```sql
select transaction_date, item_description, item_characteristics, quantity, price,
       customer_name, customer_address, customer_occupation, customer_age, verification_method
from kobutsu_daicho order by transaction_date desc;
```
- **法定保管期間＝最終記載日から3年**。データを消さない運用（論理削除も避ける）。
- 1万円未満免除・例外品目の判定は実装していない＝**全件記録**（安全側）。

## 6c. Phase 3（在庫・販売・粗利）

### マイグレーション
- `supabase/migrations/0004_phase3_schema.sql` を適用（products / product_source_items / sales + 2 enum）。

### E2E（実機）
1. まとめ買いした案件の詳細→「この案件を商品化する」。
2. 商品化画面で **仕入プール／割当済／残** を見ながら：
   - 1明細を選んで複数商品を作る（バラ売り）
   - 複数明細を選んで1商品を作る（ロット）
3. 在庫一覧（/products）→ 商品 → 販売登録（売値・販路・売却日）→ **粗利 = 売値 − 原価** が出る。
4. 売却済の商品に再度販売 → ブロック（409）。

### 注意
- 仕入原価は**手動入力**（自動按分なし）。原価合計が仕入を超えると残がマイナス表示（警告のみ・ブロックしない）。
- 粗利は販売時点の原価でスナップショット。

## 6d. Phase 4（紹介フィー）

### マイグレーション
- `supabase/migrations/0005_phase4_schema.sql` を適用（tk / ambassadors / fee_settings / referral_fees + 2 enum + cases FK）。

### 事前登録（マスタ）
1. `/settings/tk` で TK を登録（任意）。
2. `/settings/ambassadors` でアンバサダー登録（TK配下 or 直）。
3. `/settings/fees` でフィー率を1行登録（適用開始日必須）。**率未登録だとフィーは生成されない**。

### E2E（実機）
1. 予約登録で source=紹介 を選び、アンバサダーを紐付け。
2. 買取/回収を入力し精算確定 → `referral_fees` が自動生成（直=本人/TK経由=TK、内訳は記録）。
3. `/fees` で未払い一覧→「支払済にする」で paid に。
4. 非紹介案件・アンバサダー未紐付けはフィー生成されない。

### 注意
- フィーは精算時に1回だけ生成（冪等）。生成後は率を変えても再計算しない。
- 会社の支払い先は pay_to（直=ambassador / TK経由=tk）。tk_portion/ambassador_portion は記録のみ。

## 7. テスト一覧（現状81件 / 13ファイル・`npm run test` で確認）
- `lib/fee.test.ts` — 紹介フィー計算（3件）
- `lib/settlement.test.ts` — 古物台帳の組み立て（2件）
- `lib/money.test.ts` — netAmount / grossProfit / sumCosts を含む（16件）
- `lib/money.test.ts` — 金額の決定論集計（8件）
- `lib/liffAuth.test.ts` — IDトークン検証＋staff突合（3件）
- `lib/api.test.ts` — APIレスポンスヘルパ（2件）
- `lib/pdf/font.test.tsx` — 日本語PDF生成（1件）
- `lib/pdf/templates.test.tsx` — 買取伝票・領収書テンプレート（2件）

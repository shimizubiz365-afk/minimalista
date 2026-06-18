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

## 3. スタッフ登録（初回）

LINEログインしたユーザーを `staff.line_user_id` に紐付けないと、全APIが 401 になる。
1. 暫定でスタッフ行を作る（マイグレーションのサンプルで `Shun` を1行投入済み）。
2. 自分の LINE userId を取得：LIFFアプリを一度開き、ブラウザのコンソール等で `liff.getProfile()` の `userId` を確認（または一時的に画面に表示）。
3. SQL で紐付け：
   ```sql
   update staff set line_user_id = 'Uxxxxxxxx...' where name = 'Shun';
   ```

## 4. デプロイ

- Vercel 推奨（Next.js 16）。環境変数を Vercel に設定。
- `@react-pdf/renderer` はサーバー（Node ランタイム）で動く。API route はデフォルトで Node 実行。
- フォント `public/fonts/NotoSansJP-Regular.ttf` はリポジトリに含まれている（`process.cwd()/public/fonts` から読む）。

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

### E2E（実機）
1. 買取明細のある案件で「本人確認を実施」→ 身分証撮影＋確認方法＋職業＋生年を保存。
2. 本人確認せず「精算を確定」→ **ブロックされる**こと（「本人確認が未完了です」）。
3. 本人確認後に「精算を確定」（受領/支払現金を入力）→ settlements 作成・kobutsu_daicho が買取件数分生成・案件が closed。
4. 顧客名を後から変更しても、台帳（kobutsu_daicho）の customer_name は**変わらない**（取引時点スナップショット）。
5. 回収のみの案件は本人確認なしで精算でき、台帳は0件。

### 古物台帳の確認・運用
```sql
select transaction_date, item_description, item_characteristics, quantity, price,
       customer_name, customer_address, customer_occupation, customer_age, verification_method
from kobutsu_daicho order by transaction_date desc;
```
- **法定保管期間＝最終記載日から3年**。データを消さない運用（論理削除も避ける）。
- 1万円未満免除・例外品目の判定は実装していない＝**全件記録**（安全側）。

## 7. テスト一覧（現状21件）
- `lib/settlement.test.ts` — 古物台帳の組み立て（2件）
- `lib/money.test.ts` — netAmount を含む（11件）
- `lib/money.test.ts` — 金額の決定論集計（8件）
- `lib/liffAuth.test.ts` — IDトークン検証＋staff突合（3件）
- `lib/api.test.ts` — APIレスポンスヘルパ（2件）
- `lib/pdf/font.test.tsx` — 日本語PDF生成（1件）
- `lib/pdf/templates.test.tsx` — 買取伝票・領収書テンプレート（2件）

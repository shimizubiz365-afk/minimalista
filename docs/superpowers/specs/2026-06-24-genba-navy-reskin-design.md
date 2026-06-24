# GENBA ブラッシュアップ設計書 — 旧MINIMALISTA(navy)デザイン × 現GENBA本番

作成日: 2026-06-24
版: v1.0
関連: `docs/UI_SPEC.md`(旧版・nexstory/legacy-prototype-2026-04 branch) / `docs/RUNBOOK.md`

---

## 0. 目的とスコープ

現GENBA（LIFF業務システム・本番稼働中）の**見た目とUX骨格**を、旧プロトタイプ「MINIMALISTA(navy)」の完成されたデザイン思想に統合し、ブラッシュアップする。

### やること（スコープ内）
- 旧版のデザイントークン・共通コンポーネント・「今日やること」ダッシュボード思想・下部ナビ・状態可視化・大ボタンを、**現GENBAの動いている画面に適用**する
- 全画面をミニマリスタの世界観（オフホワイト＋深緑＋ゴールド）に統一

### やらないこと（スコープ外・将来）
- **中身（バックエンド）は一切変更しない**：LIFF認証・Supabaseスキーマ・API routes・PDF生成・古物台帳・精算・紹介フィー計算の**ロジックは現状維持**
- ステータスのDB拡張（旧版14段階）は今回見送り。現データモデル（reserved/visiting/visited 等）のまま、**見た目だけ**状態可視化を強化
- 旧版の重い構想（Claude Vision立米見積・Googleフォーム/カレンダー/GAS連携・チャットAI構造化）は**今回やらない**
- データ移行なし

### 設計三原則（旧UI_SPEC継承）
1. 引き算の美学 — 情報は最小限、余白で呼吸
2. 現場で迷わない — 「次やること」が常にトップ、1〜3タップ完結
3. 一目で状態が分かる — 色・アイコン・配置で認知負荷ゼロ

---

## 1. デザイントークン（`app/globals.css` に移植）

旧版`@theme inline`をそのまま採用（Tailwind v4・GENBAも同構成なので素直に差し替え）。

```
ベース:    bg #FAFAF7 / fg #1A1A1A / surface #FFFFFF / border #E8E6E0
アクセント: primary #2D3E3B(深緑) / accent #C9A96E(ゴールド)
セマンティック: success #4A7C59 / warning #C17817 / danger #A34545 / info #5A7A8C
テキスト階層: muted #6B6B6B / subtle #A8A8A8
シャドウ: sm 0 1px 2px rgba(26,26,26,.04) / md .06 / lg .08
角丸: sm 4 / md 8 / lg 12 / full
```
- アニメ：`pulse-dot` / `pulse-ring` / `card-tap:active{scale .98}` / `scrollbar-hide`
- フォント：`next/font/google` の Noto Sans JP を `--font-sans` に。本文 line-height 1.6 / letter-spacing .01em
- **現行の白背景テーマ（#ffffff/#171717・Arial）は撤去**

### タッチターゲット
最小44px / 主要ボタン56px / 重要CTA 64px（下部・親指届く位置）

---

## 2. 依存追加

```
lucide-react      アイコン（旧版と同じ。Home/Calendar/FileText/Settings/ArrowRight/ArrowLeft 等）
clsx              条件付きclass
tailwind-merge    class衝突解決
```
`@react-pdf/renderer` 等の既存は維持。フォントTTF(public/fonts)はPDF用に残す。

---

## 3. 共通コンポーネント（`components/` 新設）

旧版を移植し、GENBAの実データ・ルートに合わせて調整。

| 部品 | 役割 | 備考 |
|---|---|---|
| `AppHeader` | 上部スティッキーバー（ロゴ or 戻る＋タイトル＋右スロット） | 旧版そのまま。右はスタッフ頭文字 |
| `BottomNav` | 下部固定4タブ | **GENBAのルートに合わせて再マップ**（下記4節） |
| `StatusBadge` | 左ドット＋ラベル（色・パルス） | GENBAの実ステータス語彙にマップ |
| `Card` | 白カード(角丸8/影sm/p16)＋`card-tap` | 一覧・詳細の基本単位 |
| `Button` | Primary/Secondary/Ghost/Danger・アイコン＋テキスト併記・高さ56/64 | |
| `Field` | ラベル上・枠線のみ・フォーカス下線primary・必須*はゴールド | フォーム刷新 |
| `SectionHeader` | 「今日の訪問 3件」型の見出し | |

`max-w-md mx-auto` のモバイルコンテナ＋`pb-24`（下部ナビ分）を全画面共通に（`app/layout.tsx` か `(app)` グループで）。

---

## 4. 下部ナビのマッピング（GENBA実ルート）

旧版(ホーム/予約/レポート/設定)をGENBAの機能に合わせ4タブに：

| タブ | アイコン | 遷移先 | アクティブ判定 |
|---|---|---|---|
| ホーム | Home | `/` | `/` |
| 案件 | Calendar | `/cases` | `/cases`配下 |
| 在庫 | Package | `/products` | `/products`配下 |
| 設定 | Settings | `/settings/...`（集約ページ新設 or `/fees`含む） | `/settings`/`/fees` |

※ フィー台帳は設定配下 or 在庫タブ内のサブ導線として整理（実装時に確定）。

---

## 5. 画面別リスキン計画

中身（API呼び出し・ロジック）は維持し、**JSX/クラスのみ**ネイビー風に再構成。

### S01 ホーム `/`（最重要・現状はリンク集）
旧版S01ダッシュボードに刷新：
- ヘッダー（ロゴ＋スタッフ頭文字）
- 挨拶＋日付（「2026年6月24日 水 / おはようございます、◯◯さん」）— staff名はLIFFプロフィール or staff行
- **本日の進捗バー**（例：本日の訪問 0/N 完了）— `/api/cases?status=...` 集計
- **今日の訪問**カード群（時刻・StatusBadge・source タグ・顧客名＋様・住所・希望品目・大「訪問開始」ボタン→`/cases/[id]`）
- **要対応**セクション（日程未確定・本人確認未・精算未 等を抽出）
- リンク集（在庫/フィー/設定）は下部ナビへ移行し撤去

### S02 案件一覧 `/cases`
- タブ（予約/訪問中/訪問完了）を pill 型に
- 各案件を Card 化（時刻・StatusBadge・顧客名＋様・住所・エリア）
- 右上「＋予約登録」を primary ボタン

### S03 案件詳細 `/cases/[id]` ＋ 買取`/purchase`・回収`/collection`
- ヘッダーは戻る＋顧客名
- 状態タイムライン（現データで表現できる範囲）＋次アクションを大CTAで
- 買取/回収入力フォームを `Field`/`Button` で刷新（明細追加・写真は大タップ領域）

### S04 本人確認 `/cases/[id]/verify`・精算
- カード化、必須項目はゴールド*、精算確定は重要CTA(64px)
- 古物台帳・PDF発行ロジックは不変（ボタンの見た目のみ刷新）

### S05 在庫・販売 `/products`,`/products/[id]`
- 商品 Card（状態バッジ・原価/売値/粗利）、販売登録フォーム刷新

### S06 フィー `/fees`・設定 `/settings/*`
- リスト/カード統一、設定は集約ナビ

---

## 6. ステータス可視化（DB非変更）

現GENBAの実ステータス（例 reserved/visiting/visited、商品 登録/搬入/出品/販売/売約/入金）を、`StatusBadge` の色マップに割当てるのみ。語彙の追加・タイムラインの永続化はしない（表示は現データから導出）。

旧版14段階への格上げは**将来フェーズ**（DBマイグレーション要のため本スコープ外）。

---

## 7. 段階リリース

各Pごとに `vercel --prod` → LIFF実機確認 → 次へ。

- **P0 土台＋ホーム**：globals.css・フォント・依存・共通部品・`/`ダッシュボード。ここで雰囲気が激変
- **P1 案件まわり**：`/cases`一覧・詳細・買取/回収入力（現場で最頻出）
- **P2 本人確認・精算・PDF導線**：法令フローの見た目刷新（ロジック不変）
- **P3 在庫・販売・フィー・設定＋下部ナビ最終化**

---

## 8. 検証

- `npm run test`（29件）が緑のまま（UIリスキンはロジック非変更なので維持されるはず。壊れたら即修正）
- `npm run build` 成功
- 各P後にLIFF実機で主要動線（ホーム→案件→入力→PDF）を目視。PDF日本語化けの非回帰確認
- スコープ外機能（Vision/Google/AI）に触れていないこと

---

## 9. リスク・留意

- 旧版はモック前提のJSX。**データ形が違う**ので「移植」でなく「デザインを参照した再構成」。旧JSXのコピペは不可、パターンのみ流用
- `(main)`グループ等のルート再編は最小限に（既存リンク・router.push を壊さない）
- LIFF認証・apiFetch の呼び出しは現行のまま温存

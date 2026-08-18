-- 案件ステータスに「再訪問」を追加（後日また訪問が必要な案件）。
-- 画面の語彙: 確定 / 訪問完了 / 回収待ち / 再訪問 / 完了 / キャンセル
-- ※ visiting(訪問中) は enum に残すが選択肢からは外す（既存行の表示のため）。
alter type case_status add value if not exists 'revisit';

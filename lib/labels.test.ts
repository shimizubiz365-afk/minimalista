import { describe, it, expect } from "vitest";
import { CASE_STATUS_FLOW, CASE_STATUS_LABELS, label } from "./labels";

describe("案件ステータス", () => {
  it("画面に出す全ステータスに日本語ラベルがある", () => {
    for (const st of CASE_STATUS_FLOW) {
      expect(CASE_STATUS_LABELS[st], `${st} のラベルが無い`).toBeTruthy();
      // 英語の内部値がそのまま画面に出ていないこと
      expect(CASE_STATUS_LABELS[st]).not.toBe(st);
    }
  });

  it("現場の進み順で並んでいる", () => {
    expect(CASE_STATUS_FLOW.map((s) => CASE_STATUS_LABELS[s])).toEqual([
      "確定",
      "訪問完了",
      "回収待ち",
      "再訪問",
      "完了",
      "キャンセル",
    ]);
  });

  it("選択肢から外した visiting も既存行の表示用に残っている", () => {
    expect(label(CASE_STATUS_LABELS, "visiting")).toBe("訪問中");
  });

  it("未知の値はそのまま返す（安全側）", () => {
    expect(label(CASE_STATUS_LABELS, "unknown_status")).toBe("unknown_status");
    expect(label(CASE_STATUS_LABELS, null)).toBe("-");
  });
});

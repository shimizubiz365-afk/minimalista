import { describe, expect, test } from "vitest";
import { nextProductCode } from "./productCode";

describe("nextProductCode", () => {
  test("ヘッダのみ（データ無し）ならP-0001", () => {
    expect(nextProductCode([["物販コード", "商品名"]])).toBe("P-0001");
  });

  test("空配列でもP-0001", () => {
    expect(nextProductCode([])).toBe("P-0001");
  });

  test("連番の続きを返す", () => {
    const rows = [["物販コード"], ["P-0001"], ["P-0002"]];
    expect(nextProductCode(rows)).toBe("P-0003");
  });

  test("欠番があっても最大+1（重複を避ける）", () => {
    const rows = [["物販コード"], ["P-0001"], ["P-0005"]];
    expect(nextProductCode(rows)).toBe("P-0006");
  });

  test("空行や別形式コードは無視する", () => {
    const rows = [["物販コード"], ["P-0002"], ["", "商品X"], ["X-0009"]];
    expect(nextProductCode(rows)).toBe("P-0003");
  });

  test("4桁を超えても切り詰めない", () => {
    expect(nextProductCode([["物販コード"], ["P-9999"]])).toBe("P-10000");
  });
});

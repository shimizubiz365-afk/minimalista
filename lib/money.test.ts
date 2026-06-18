import { describe, it, expect } from "vitest";
import { sumAmounts, sumWorkFees, formatYen } from "@/lib/money";

describe("sumAmounts", () => {
  it("空配列は0", () => expect(sumAmounts([])).toBe(0));
  it("1件", () => expect(sumAmounts([{ amount: 1500 }])).toBe(1500));
  it("複数件", () =>
    expect(sumAmounts([{ amount: 1500 }, { amount: 320 }, { amount: 80 }])).toBe(1900));
  it("大きい額", () =>
    expect(sumAmounts([{ amount: 1000000 }, { amount: 2500000 }])).toBe(3500000));
});

describe("sumWorkFees", () => {
  it("空配列は0", () => expect(sumWorkFees([])).toBe(0));
  it("複数件", () =>
    expect(sumWorkFees([{ work_fee: 3000 }, { work_fee: 5000 }])).toBe(8000));
});

describe("formatYen", () => {
  it("3桁区切り+円", () => expect(formatYen(1234567)).toBe("¥1,234,567"));
  it("0", () => expect(formatYen(0)).toBe("¥0"));
});

import { describe, it, expect } from "vitest";
import { sumAmounts, sumWorkFees, formatYen, netAmount, grossProfit, sumCosts } from "@/lib/money";

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

describe("netAmount", () => {
  it("買取超過は正", () => expect(netAmount(10000, 3000)).toBe(7000));
  it("受領超過は負", () => expect(netAmount(2000, 5000)).toBe(-3000));
  it("同額は0", () => expect(netAmount(4000, 4000)).toBe(0));
});

describe("grossProfit", () => {
  it("益は正", () => expect(grossProfit(5000, 3000)).toBe(2000));
  it("損は負", () => expect(grossProfit(1000, 1500)).toBe(-500));
  it("同額0", () => expect(grossProfit(2000, 2000)).toBe(0));
});

describe("sumCosts", () => {
  it("空は0", () => expect(sumCosts([])).toBe(0));
  it("複数", () => expect(sumCosts([{ cost: 4000 }, { cost: 1000 }])).toBe(5000));
});

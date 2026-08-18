import { describe, it, expect } from "vitest";
import {
  sumAmounts,
  sumWorkFees,
  formatYen,
  netAmount,
  grossProfit,
  sumCosts,
  taxExclusive,
  taxInclusive,
  taxBreakdown,
} from "@/lib/money";

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

describe("精算の差引（PDFと一致させる）", () => {
  it("外税: 作業費は+10%して差し引く", () => {
    const work = taxBreakdown(50000, "exclusive");
    expect(work.total).toBe(55000);
    expect(netAmount(80000, work.total)).toBe(25000);
  });
  it("内税: 入力額がそのまま税込", () => {
    const work = taxBreakdown(55000, "inclusive");
    expect(work.total).toBe(55000);
    expect(netAmount(80000, work.total)).toBe(25000);
  });
  it("買取より作業費が多ければ差引はマイナス（お客様から受領）", () => {
    const work = taxBreakdown(30000, "exclusive");
    expect(netAmount(10000, work.total)).toBe(-23000);
  });
});

describe("formatYen", () => {
  it("3桁区切り+円", () => expect(formatYen(1234567)).toBe("¥1,234,567"));
  it("0", () => expect(formatYen(0)).toBe("¥0"));
  it("マイナスは記号を先頭に出す（値引き・サービス）", () =>
    expect(formatYen(-3000)).toBe("−¥3,000"));
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

describe("taxExclusive(外税)", () => {
  it("10000税抜→税1000/税込11000", () =>
    expect(taxExclusive(10000)).toEqual({ subtotal: 10000, tax: 1000, total: 11000 }));
  it("端数は切り捨て(1055→税105)", () =>
    expect(taxExclusive(1055)).toEqual({ subtotal: 1055, tax: 105, total: 1160 }));
  it("0は全て0", () =>
    expect(taxExclusive(0)).toEqual({ subtotal: 0, tax: 0, total: 0 }));
});

describe("taxInclusive(内税)", () => {
  it("11000税込→内税1000/税抜10000", () =>
    expect(taxInclusive(11000)).toEqual({ subtotal: 10000, tax: 1000, total: 11000 }));
  it("内税は切り捨て(1080→内税98)", () =>
    expect(taxInclusive(1080)).toEqual({ subtotal: 982, tax: 98, total: 1080 }));
});

describe("taxBreakdown", () => {
  it("exclusiveは外税計算", () =>
    expect(taxBreakdown(10000, "exclusive").total).toBe(11000));
  it("inclusiveは内税計算", () =>
    expect(taxBreakdown(11000, "inclusive").total).toBe(11000));
  it("inclusiveのtotalは入力額そのまま", () =>
    expect(taxBreakdown(5000, "inclusive").subtotal).toBe(4546));
});

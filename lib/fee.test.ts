import { describe, it, expect } from "vitest";
import { computeReferralFee } from "@/lib/fee";

describe("computeReferralFee", () => {
  it("直アンバサダー：全額ambassador・tk_portion=0", () => {
    const r = computeReferralFee({
      buyTotal: 100000,
      workTotal: 20000,
      rateBuy: 0.05,
      rateWork: 0.1,
      tkShare: 0.6,
      ambassadorId: "amb1",
      ambassadorTkId: null,
    });
    expect(r.fee_buy).toBe(5000);
    expect(r.fee_work).toBe(2000);
    expect(r.fee_total).toBe(7000);
    expect(r.pay_to).toBe("ambassador");
    expect(r.pay_to_id).toBe("amb1");
    expect(r.tk_portion).toBe(0);
    expect(r.ambassador_portion).toBe(7000);
  });

  it("TK経由：tk_share按分・残差ambassador", () => {
    const r = computeReferralFee({
      buyTotal: 100000,
      workTotal: 20000,
      rateBuy: 0.05,
      rateWork: 0.1,
      tkShare: 0.6,
      ambassadorId: "amb1",
      ambassadorTkId: "tk1",
    });
    expect(r.fee_total).toBe(7000);
    expect(r.pay_to).toBe("tk");
    expect(r.pay_to_id).toBe("tk1");
    expect(r.tk_portion).toBe(4200); // round(7000*0.6)
    expect(r.ambassador_portion).toBe(2800);
  });

  it("端数は Math.round", () => {
    const r = computeReferralFee({
      buyTotal: 3333,
      workTotal: 0,
      rateBuy: 0.05,
      rateWork: 0.1,
      tkShare: 0.5,
      ambassadorId: "a",
      ambassadorTkId: null,
    });
    expect(r.fee_buy).toBe(167); // round(166.65)
    expect(r.fee_work).toBe(0);
    expect(r.fee_total).toBe(167);
  });
});

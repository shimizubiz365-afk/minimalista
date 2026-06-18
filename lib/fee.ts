export type FeeResult = {
  fee_buy: number;
  fee_work: number;
  fee_total: number;
  pay_to: "ambassador" | "tk";
  pay_to_id: string;
  tk_portion: number;
  ambassador_portion: number;
};

export function computeReferralFee(input: {
  buyTotal: number;
  workTotal: number;
  rateBuy: number;
  rateWork: number;
  tkShare: number;
  ambassadorId: string;
  ambassadorTkId: string | null;
}): FeeResult {
  const fee_buy = Math.round(input.buyTotal * input.rateBuy);
  const fee_work = Math.round(input.workTotal * input.rateWork);
  const fee_total = fee_buy + fee_work;
  if (input.ambassadorTkId == null) {
    return {
      fee_buy,
      fee_work,
      fee_total,
      pay_to: "ambassador",
      pay_to_id: input.ambassadorId,
      tk_portion: 0,
      ambassador_portion: fee_total,
    };
  }
  const tk_portion = Math.round(fee_total * input.tkShare);
  return {
    fee_buy,
    fee_work,
    fee_total,
    pay_to: "tk",
    pay_to_id: input.ambassadorTkId,
    tk_portion,
    ambassador_portion: fee_total - tk_portion,
  };
}

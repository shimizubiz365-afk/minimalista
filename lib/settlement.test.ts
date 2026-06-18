import { describe, it, expect } from "vitest";
import { buildDaichoRows } from "@/lib/settlement";

const base = {
  caseId: "case1",
  customer: { name: "山田太郎", address: "東京都X", occupation: "会社員", birth_year: 1985 },
  verificationMethod: "運転免許証",
  idMediaId: "media1",
  txDate: "2026-06-18",
  currentYear: 2026,
};

describe("buildDaichoRows", () => {
  it("買取明細1件→台帳1行・法定項目が埋まる", () => {
    const rows = buildDaichoRows({
      ...base,
      purchaseItems: [
        { id: "p1", name: "腕時計", brand: "SEIKO", model: "ABC", condition: "美品", amount: 12000 },
      ],
    });
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.purchase_item_id).toBe("p1");
    expect(r.case_id).toBe("case1");
    expect(r.item_description).toBe("腕時計 / SEIKO / ABC");
    expect(r.item_characteristics).toBe("美品");
    expect(r.price).toBe(12000);
    expect(r.customer_name).toBe("山田太郎");
    expect(r.customer_address).toBe("東京都X");
    expect(r.customer_occupation).toBe("会社員");
    expect(r.customer_age).toBe(41); // 2026 - 1985
    expect(r.verification_method).toBe("運転免許証");
    expect(r.id_media_id).toBe("media1");
    expect(r.quantity).toBe(1);
    expect(r.transaction_date).toBe("2026-06-18");
  });

  it("複数明細→件数一致", () => {
    const rows = buildDaichoRows({
      ...base,
      purchaseItems: [
        { id: "p1", name: "A", brand: null, model: null, condition: null, amount: 100 },
        { id: "p2", name: "B", brand: null, model: null, condition: null, amount: 200 },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].item_description).toBe("A");
    expect(rows[1].customer_age).toBe(41);
  });
});

import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@/lib/pdf/renderToBuffer";
import { PurchaseSlip } from "@/lib/pdf/purchaseSlip";
import { Receipt } from "@/lib/pdf/receipt";

const cust = { name: "山田太郎", address: "東京都...", customer_no: "C-000001" };

describe("PDFテンプレート", () => {
  it("買取伝票が生成できる", async () => {
    const buf = await renderToBuffer(
      PurchaseSlip({
        customer: cust,
        items: [{ name: "腕時計", brand: "SEIKO", model: null, condition: "美品", amount: 12000 }],
        total: 12000,
        date: "2026-06-18",
        staffName: "Shun",
      })
    );
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("領収書が生成できる", async () => {
    const buf = await renderToBuffer(
      Receipt({
        customer: cust,
        items: [{ item_name: "ソファ", work_fee: 5000 }],
        total: 5000,
        date: "2026-06-18",
        staffName: "Shun",
      })
    );
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });
});

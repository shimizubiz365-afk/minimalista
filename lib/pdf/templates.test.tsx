import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@/lib/pdf/renderToBuffer";
import { PurchaseSlip } from "@/lib/pdf/purchaseSlip";
import { Receipt } from "@/lib/pdf/receipt";
import { WorkOrder } from "@/lib/pdf/workOrder";
import { Invoice } from "@/lib/pdf/invoice";
import { taxExclusive, taxInclusive } from "@/lib/money";

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

  it("領収書(外税)が生成できる", async () => {
    const buf = await renderToBuffer(
      Receipt({
        customer: cust,
        items: [{ item_name: "ソファ", work_fee: 5000 }],
        tax: taxExclusive(5000),
        taxMode: "exclusive",
        date: "2026-06-18",
        staffName: "Shun",
      })
    );
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("作業依頼書(外税)が生成できる", async () => {
    const buf = await renderToBuffer(
      WorkOrder({
        customer: cust,
        items: [{ item_name: "ソファ", work_fee: 5000 }],
        tax: taxExclusive(5000),
        taxMode: "exclusive",
        date: "2026-06-18",
        staffName: "Shun",
      })
    );
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("作業依頼書(内税)が生成できる", async () => {
    const buf = await renderToBuffer(
      WorkOrder({
        customer: cust,
        items: [{ item_name: "ソファ", work_fee: 5000 }],
        tax: taxInclusive(5000),
        taxMode: "inclusive",
        date: "2026-06-18",
        staffName: "Shun",
      })
    );
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("請求書が生成できる", async () => {
    const buf = await renderToBuffer(
      Invoice({
        customer: cust,
        items: [{ item_name: "ソファ", work_fee: 5000 }],
        tax: taxExclusive(5000),
        taxMode: "exclusive",
        date: "2026-06-18",
        dueDate: "2026-07-18",
        staffName: "Shun",
      })
    );
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });
});

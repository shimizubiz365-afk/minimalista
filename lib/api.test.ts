import { describe, it, expect } from "vitest";
import { ok, fail } from "@/lib/api";

describe("api helpers", () => {
  it("ok は {ok:true,data}", async () => {
    const r = ok({ a: 1 });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, data: { a: 1 } });
  });
  it("fail は {ok:false,error} と status", async () => {
    const r = fail("boom", 400);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, error: "boom" });
  });
});

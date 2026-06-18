import { describe, it, expect, vi, beforeEach } from "vitest";

// supabaseAdmin の select().eq().eq().maybeSingle() チェーンをモック
const maybeSingle = vi.fn();
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }) }),
  }),
}));

import { staffFromIdToken } from "@/lib/liffAuth";

function mockVerify(ok: boolean, sub = "U_x") {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: async () => (ok ? { sub } : {}),
  }) as unknown as typeof fetch;
}

describe("staffFromIdToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LINE_LOGIN_CHANNEL_ID = "cid";
  });

  it("IDトークン検証に失敗したら null", async () => {
    mockVerify(false);
    expect(await staffFromIdToken("bad")).toBeNull();
  });

  it("検証OKでも該当staffが無ければ null", async () => {
    mockVerify(true);
    maybeSingle.mockResolvedValue({ data: null });
    expect(await staffFromIdToken("ok")).toBeNull();
  });

  it("検証OKでactiveなstaffがあれば {id,name}", async () => {
    mockVerify(true);
    maybeSingle.mockResolvedValue({ data: { id: "s1", name: "Shun" } });
    expect(await staffFromIdToken("ok")).toEqual({ id: "s1", name: "Shun" });
  });
});

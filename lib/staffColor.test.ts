import { describe, expect, test } from "vitest";
import { staffColor, STAFF_PALETTE } from "./staffColor";

describe("staffColor", () => {
  test("同じIDは常に同じ色（決定的）", () => {
    expect(staffColor("abc")).toBe(staffColor("abc"));
    expect(staffColor("b212a271-bdde")).toBe(staffColor("b212a271-bdde"));
  });

  test("常にパレット内の色を返す", () => {
    for (const id of ["a", "xyz", "b212a271", "9999", "山田"]) {
      expect(STAFF_PALETTE).toContain(staffColor(id));
    }
  });

  test("空・未割り当てはニュートラル(グレー)", () => {
    expect(staffColor("")).toBe("#94a3b8");
    expect(staffColor(null)).toBe("#94a3b8");
    expect(staffColor(undefined)).toBe("#94a3b8");
  });

  test("異なるIDはなるべく散る（少なくとも一部は別色）", () => {
    const colors = new Set(["id-1", "id-2", "id-3", "id-4"].map((i) => staffColor(i)));
    expect(colors.size).toBeGreaterThan(1);
  });
});

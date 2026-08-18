import { describe, expect, test } from "vitest";
import { monthGrid, groupVisitsByDay, ymKey } from "./calendar";

describe("monthGrid", () => {
  test("2024年1月: 1日は月曜＝先頭に日曜分の空1つ・31日", () => {
    const g = monthGrid(2024, 1);
    expect(g[0]).toBeNull(); // 日曜セルは空
    expect(g[1]).toEqual({ day: 1, key: "2024-01-01" });
    expect(g.filter(Boolean).length).toBe(31);
    expect(g.length % 7).toBe(0); // 週単位に整列
  });
  test("2024年2月: うるう年で29日", () => {
    expect(monthGrid(2024, 2).filter(Boolean).length).toBe(29);
  });
  test("2026年6月: 30日", () => {
    const g = monthGrid(2026, 6);
    expect(g.filter(Boolean).length).toBe(30);
    expect(g.find((c) => c?.day === 1)?.key).toBe("2026-06-01");
    expect(g.find((c) => c?.day === 30)?.key).toBe("2026-06-30");
  });
});

describe("groupVisitsByDay", () => {
  test("visit_atの日付(先頭10文字)でまとめ・nullは除外", () => {
    const cases = [
      { id: "a", visit_at: "2026-06-28T14:30:00+00:00" },
      { id: "b", visit_at: "2026-06-28T09:00:00+00:00" },
      { id: "c", visit_at: null },
      { id: "d", visit_at: "2026-06-29T10:00:00+00:00" },
    ];
    const m = groupVisitsByDay(cases);
    expect(m.get("2026-06-28")?.map((c) => c.id)).toEqual(["a", "b"]);
    expect(m.get("2026-06-29")?.map((c) => c.id)).toEqual(["d"]);
    expect(m.has("")).toBe(false);
    expect([...m.keys()].length).toBe(2);
  });
});

describe("ymKey", () => {
  test("年月をYYYY-MM形式に", () => {
    expect(ymKey(2026, 6)).toBe("2026-06");
    expect(ymKey(2026, 12)).toBe("2026-12");
  });
});

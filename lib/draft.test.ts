import { describe, it, expect } from "vitest";
import { serializeDraft, parseDraft } from "./draft";

const NOW = 1_700_000_000_000;

describe("下書きの保存形式", () => {
  it("保存したものをそのまま読み戻せる", () => {
    const v = { name: "山田", amount: "3000" };
    expect(parseDraft(serializeDraft(v, NOW), NOW)).toEqual(v);
  });

  it("1週間を超えた下書きは復元しない", () => {
    const raw = serializeDraft({ name: "古い" }, NOW);
    const week = 7 * 24 * 60 * 60 * 1000;
    expect(parseDraft(raw, NOW + week - 1)).toEqual({ name: "古い" });
    expect(parseDraft(raw, NOW + week + 1)).toBeNull();
  });

  it("壊れた値・別形式・空は復元しない（安全側）", () => {
    expect(parseDraft(null, NOW)).toBeNull();
    expect(parseDraft("{壊れ", NOW)).toBeNull();
    expect(parseDraft(JSON.stringify({ data: 1 }), NOW)).toBeNull();
    expect(parseDraft(JSON.stringify({ v: 2, at: NOW, data: 1 }), NOW)).toBeNull();
    expect(parseDraft(JSON.stringify({ v: 1, at: NOW }), NOW)).toBeNull();
  });

  it("falsy な値も正しく復元する（0や空文字を捨てない）", () => {
    expect(parseDraft(serializeDraft({ a: "" }, NOW), NOW)).toEqual({ a: "" });
    expect(parseDraft(serializeDraft(0, NOW), NOW)).toBe(0);
  });
});

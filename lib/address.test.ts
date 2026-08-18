import { describe, expect, test } from "vitest";
import { splitAddress, combineAddress, normalizeZip } from "./address";

describe("normalizeZip", () => {
  test("7桁をXXX-XXXXに", () => {
    expect(normalizeZip("2430027")).toBe("243-0027");
    expect(normalizeZip("243-0027")).toBe("243-0027");
    expect(normalizeZip(" 243 0027 ")).toBe("243-0027");
  });
  test("7桁でなければ空", () => {
    expect(normalizeZip("12345")).toBe("");
    expect(normalizeZip("")).toBe("");
  });
});

describe("splitAddress", () => {
  test("〒のみ（住所未入力）", () => {
    expect(splitAddress("〒243-0027")).toEqual({ zip: "243-0027", rest: "" });
    expect(splitAddress("〒150-0001 ")).toEqual({ zip: "150-0001", rest: "" });
  });
  test("〒＋住所", () => {
    expect(splitAddress("〒243-0027 神奈川県大和市南林間1-2-3")).toEqual({
      zip: "243-0027",
      rest: "神奈川県大和市南林間1-2-3",
    });
  });
  test("〒なし7桁＋住所も拾う", () => {
    expect(splitAddress("2430027 神奈川県大和市")).toEqual({
      zip: "243-0027",
      rest: "神奈川県大和市",
    });
  });
  test("ハイフン無し・スペース無しの郵便番号も分割できる", () => {
    expect(splitAddress("〒2430027神奈川県厚木市愛甲東")).toEqual({
      zip: "243-0027",
      rest: "神奈川県厚木市愛甲東",
    });
    expect(splitAddress("2430027")).toEqual({ zip: "243-0027", rest: "" });
  });
  test("郵便番号が無い住所はrestのみ", () => {
    expect(splitAddress("東京都渋谷区宇田川町19-5")).toEqual({
      zip: "",
      rest: "東京都渋谷区宇田川町19-5",
    });
  });
  test("空・nullは空", () => {
    expect(splitAddress("")).toEqual({ zip: "", rest: "" });
    expect(splitAddress(null)).toEqual({ zip: "", rest: "" });
  });
});

describe("combineAddress", () => {
  test("郵便番号＋住所", () => {
    expect(combineAddress("243-0027", "神奈川県大和市南林間1-2-3")).toBe(
      "〒243-0027 神奈川県大和市南林間1-2-3"
    );
  });
  test("郵便番号のみ", () => {
    expect(combineAddress("243-0027", "")).toBe("〒243-0027");
  });
  test("住所のみ", () => {
    expect(combineAddress("", "東京都渋谷区")).toBe("東京都渋谷区");
  });
  test("両方空は空", () => {
    expect(combineAddress("", "")).toBe("");
  });
  test("生の7桁郵便番号も正規化して合成", () => {
    expect(combineAddress("2430027", "神奈川県")).toBe("〒243-0027 神奈川県");
  });
});

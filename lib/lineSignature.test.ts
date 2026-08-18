import { describe, expect, test } from "vitest";
import { verifyLineSignature } from "./lineSignature";

// 固定フィクスチャ（node crypto で算出した正解）。アルゴリズム=HMAC-SHA256 / base64 を固定する。
const BODY = '{"events":[]}';
const SECRET = "testsecret";
const GOOD = "7/zjpxmsANrs8ptIk/KkFoHlDrLSXUZV+eHj+1N7Rdg=";

describe("verifyLineSignature", () => {
  test("正しい署名はtrue", () => {
    expect(verifyLineSignature(BODY, GOOD, SECRET)).toBe(true);
  });

  test("改ざんされた本文はfalse", () => {
    expect(verifyLineSignature('{"events":[1]}', GOOD, SECRET)).toBe(false);
  });

  test("違うシークレットはfalse", () => {
    expect(verifyLineSignature(BODY, GOOD, "wrongsecret")).toBe(false);
  });

  test("署名なし・シークレットなしはfalse", () => {
    expect(verifyLineSignature(BODY, "", SECRET)).toBe(false);
    expect(verifyLineSignature(BODY, GOOD, "")).toBe(false);
  });
});

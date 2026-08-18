import { describe, expect, test } from "vitest";
import { parseLeadTemplate } from "./lineTemplate";

describe("parseLeadTemplate", () => {
  test("ラベルと同じ行に値があるテンプレを全項目パースする", () => {
    const msg = [
      "【お名前】山田花子",
      "【電話番号】090-1234-5678",
      "【郵便番号】150-0001",
      "【ご紹介者】田中さん",
      "【ご相談内容】ブランドバッグと食器を処分したい",
      "【お電話可能な時間帯】平日18時以降",
    ].join("\n");

    expect(parseLeadTemplate(msg)).toEqual({
      name: "山田花子",
      phone: "090-1234-5678",
      zip: "150-0001",
      referrer: "田中さん",
      inquiry: "ブランドバッグと食器を処分したい",
      callTime: "平日18時以降",
    });
  });

  test("ラベルの次の行に値があるテンプレもパースする", () => {
    const msg = [
      "【お名前】",
      "佐藤太郎",
      "【電話番号】",
      "08011112222",
      "【ご相談内容】",
      "貴金属の買取",
    ].join("\n");

    const r = parseLeadTemplate(msg);
    expect(r?.name).toBe("佐藤太郎");
    expect(r?.phone).toBe("080-1111-2222");
    expect(r?.inquiry).toBe("貴金属の買取");
  });

  test("※注記と例:ヒントは値から除去する", () => {
    const msg = [
      "【お名前】鈴木",
      "【ご紹介者】※分かる範囲で",
      "【お電話可能な時間帯】例:平日18時以降 / 土日10〜15時",
    ].join("\n");

    const r = parseLeadTemplate(msg);
    expect(r?.name).toBe("鈴木");
    expect(r?.referrer).toBeUndefined(); // ※注記のみ＝未入力
    expect(r?.callTime).toBeUndefined(); // 例:ヒントのみ＝未入力
  });

  test("郵便番号はXXX-XXXXに正規化する", () => {
    const r = parseLeadTemplate("【お名前】A\n【郵便番号】1500001");
    expect(r?.zip).toBe("150-0001");
  });

  test("電話番号は数字とハイフンのみ残す", () => {
    const r = parseLeadTemplate("【お名前】A\n【電話番号】 090 1234 5678 ");
    expect(r?.phone).toBe("090-1234-5678");
  });

  test("ラベル表記ゆれ（氏名/TEL/〒/相談内容）も拾う", () => {
    const msg = ["【氏名】高橋", "【TEL】09099998888", "【〒】1000001", "【相談内容】時計"].join("\n");
    const r = parseLeadTemplate(msg);
    expect(r?.name).toBe("高橋");
    expect(r?.phone).toBe("090-9999-8888");
    expect(r?.zip).toBe("100-0001");
    expect(r?.inquiry).toBe("時計");
  });

  test("実際の顧客メッセージ（次行入力＋自動応答フッター付き）を正しく拾う", () => {
    const msg = [
      "【お名前】",
      "清水　駿",
      "【電話番号】",
      "09049640432",
      "【郵便番号】",
      "242-0024",
      "【ご紹介者】※分かる範囲で",
      "",
      "【ご相談内容】",
      "※手放したいもの・お困りごと",
      "引越しに際しての買取",
      "【お電話可能な時間帯】",
      "例:平日18時以降 / 土日10〜15時",
      "━━━━━━━━━━",
      "いつでも",
      "ご返信いただき次第、",
      "担当者よりお電話いたします。",
    ].join("\n");

    expect(parseLeadTemplate(msg)).toEqual({
      name: "清水　駿", // 氏名の全角スペースは保持
      phone: "090-4964-0432",
      zip: "242-0024",
      inquiry: "引越しに際しての買取",
      // ご紹介者は空、時間帯は例:ヒントのみ→未入力。━以降の自動応答フッターは混入させない。
    });
  });

  test("テンプレでない普通の挨拶はnullを返す", () => {
    expect(parseLeadTemplate("こんにちは、ちょっと質問です")).toBeNull();
    expect(parseLeadTemplate("")).toBeNull();
  });

  test("ラベルはあるが氏名も電話も空ならnull（誤検知防止）", () => {
    const msg = ["【お名前】", "【電話番号】", "【ご相談内容】"].join("\n");
    expect(parseLeadTemplate(msg)).toBeNull();
  });
});

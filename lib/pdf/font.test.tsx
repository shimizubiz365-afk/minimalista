import { describe, it, expect } from "vitest";
import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { renderToBuffer } from "@/lib/pdf/renderToBuffer";

describe("PDF 日本語生成", () => {
  it("日本語テキストを含むPDFをBufferで生成できる", async () => {
    const el = (
      <Document>
        <Page style={{ fontFamily: "NotoSansJP", padding: 24 }}>
          <View>
            <Text>買取伝票 テスト 領収書 ミニマリスタ 御中</Text>
          </View>
        </Page>
      </Document>
    );
    const buf = await renderToBuffer(el);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });
});

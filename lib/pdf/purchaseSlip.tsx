import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { company } from "@/lib/company";
import { formatYen } from "@/lib/money";
import type { SlipCustomer, PurchaseLine } from "./types";

const s = StyleSheet.create({
  page: { fontFamily: "NotoSansJP", fontSize: 10, padding: 32 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 12, textAlign: "center" },
  row: { flexDirection: "row", borderBottom: "1pt solid #ccc", paddingVertical: 4 },
  headRow: {
    flexDirection: "row",
    borderBottom: "1pt solid #ccc",
    paddingVertical: 4,
    fontWeight: "bold",
  },
  cell: { flex: 1 },
  amount: { width: 90, textAlign: "right" },
  company: { marginTop: 24, fontSize: 9, textAlign: "right" },
  total: { marginTop: 12, fontSize: 14, fontWeight: "bold", textAlign: "right" },
  meta: { marginBottom: 8 },
});

export function PurchaseSlip(props: {
  customer: SlipCustomer;
  items: PurchaseLine[];
  total: number;
  date: string;
  staffName: string;
}): React.ReactElement {
  return (
    <Document>
      <Page style={s.page}>
        <Text style={s.title}>買取伝票</Text>
        <View style={s.meta}>
          <Text>
            {props.customer.name} 様（{props.customer.customer_no}）
          </Text>
          <Text>
            取引日: {props.date}　担当: {props.staffName}
          </Text>
        </View>
        <View style={s.headRow}>
          <Text style={s.cell}>品名 / ブランド / 型番 / 状態</Text>
          <Text style={s.amount}>買取額</Text>
        </View>
        {props.items.map((it, i) => (
          <View style={s.row} key={i}>
            <Text style={s.cell}>
              {[it.name, it.brand, it.model, it.condition].filter(Boolean).join(" / ")}
            </Text>
            <Text style={s.amount}>{formatYen(it.amount)}</Text>
          </View>
        ))}
        <Text style={s.total}>買取合計: {formatYen(props.total)}</Text>
        <View style={s.company}>
          <Text>{company.name}</Text>
          <Text>古物商許可番号: {company.kobutsuLicense}</Text>
          <Text>
            {company.address}　TEL {company.tel}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { company } from "@/lib/company";
import { formatYen } from "@/lib/money";
import type { TaxBreakdown, TaxMode } from "@/lib/money";
import type { SlipCustomer, CollectionLine } from "./types";

const s = StyleSheet.create({
  page: { fontFamily: "NotoSansJP", fontSize: 10, padding: 32 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 12, textAlign: "center" },
  addressee: { fontSize: 12, marginBottom: 4 },
  lead: { fontSize: 10, marginBottom: 12 },
  headRow: {
    flexDirection: "row",
    borderBottom: "1pt solid #ccc",
    paddingVertical: 4,
    marginTop: 8,
    fontWeight: "bold",
  },
  row: { flexDirection: "row", borderBottom: "1pt solid #ccc", paddingVertical: 4 },
  cell: { flex: 1 },
  fee: { width: 90, textAlign: "right" },
  subRow: { flexDirection: "row", paddingVertical: 2, marginTop: 2 },
  subLabel: { flex: 1, textAlign: "right" },
  subVal: { width: 90, textAlign: "right" },
  totalRow: { flexDirection: "row", paddingVertical: 6, marginTop: 2, borderTop: "1pt solid #333" },
  totalLabel: { flex: 1, textAlign: "right", fontWeight: "bold" },
  totalVal: { width: 90, textAlign: "right", fontWeight: "bold", fontSize: 12 },
  note: { marginTop: 8 },
  sign: { marginTop: 28, fontSize: 10 },
  signLine: { marginTop: 18, borderBottom: "1pt solid #333", width: 220 },
  company: { marginTop: 24, fontSize: 9, textAlign: "right" },
});

export function WorkOrder(props: {
  customer: SlipCustomer;
  items: CollectionLine[];
  tax: TaxBreakdown;
  taxMode: TaxMode;
  date: string;
  staffName: string;
}): React.ReactElement {
  return (
    <Document>
      <Page style={s.page}>
        <Text style={s.title}>作業依頼書</Text>
        <Text style={s.addressee}>{props.customer.name} 様</Text>
        <Text style={s.lead}>
          下記の不用品回収・整理作業を承りました。内容をご確認ください。
        </Text>
        <View style={s.headRow}>
          <Text style={s.cell}>作業内容・品目</Text>
          <Text style={s.fee}>作業費</Text>
        </View>
        {props.items.map((it, i) => (
          <View style={s.row} key={i}>
            <Text style={s.cell}>{it.item_name}</Text>
            <Text style={s.fee}>{formatYen(it.work_fee)}</Text>
          </View>
        ))}
        {props.taxMode === "exclusive" ? (
          <>
            <View style={s.subRow}>
              <Text style={s.subLabel}>小計（税抜）</Text>
              <Text style={s.subVal}>{formatYen(props.tax.subtotal)}</Text>
            </View>
            <View style={s.subRow}>
              <Text style={s.subLabel}>消費税（10%）</Text>
              <Text style={s.subVal}>{formatYen(props.tax.tax)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>合計（税込）</Text>
              <Text style={s.totalVal}>{formatYen(props.tax.total)}</Text>
            </View>
          </>
        ) : (
          <>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>作業費合計（税込）</Text>
              <Text style={s.totalVal}>{formatYen(props.tax.total)}</Text>
            </View>
            <View style={s.subRow}>
              <Text style={s.subLabel}>（うち消費税10%）</Text>
              <Text style={s.subVal}>{formatYen(props.tax.tax)}</Text>
            </View>
          </>
        )}
        <Text style={s.note}>
          依頼日: {props.date}　担当: {props.staffName}
        </Text>
        <View style={s.sign}>
          <Text>上記内容で作業を依頼します。</Text>
          <Text style={s.signLine}> </Text>
          <Text style={{ marginTop: 4 }}>お客様署名</Text>
        </View>
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

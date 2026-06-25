import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { company } from "@/lib/company";
import { formatYen } from "@/lib/money";
import type { TaxBreakdown, TaxMode } from "@/lib/money";
import type { SlipCustomer, CollectionLine } from "./types";

const s = StyleSheet.create({
  page: { fontFamily: "NotoSansJP", fontSize: 10, padding: 32 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 12, textAlign: "center" },
  addressee: { fontSize: 12, marginBottom: 8 },
  big: { fontSize: 20, fontWeight: "bold", marginVertical: 12, textAlign: "center" },
  row: { flexDirection: "row", borderBottom: "1pt solid #ccc", paddingVertical: 4 },
  headRow: {
    flexDirection: "row",
    borderBottom: "1pt solid #ccc",
    paddingVertical: 4,
    marginTop: 8,
    fontWeight: "bold",
  },
  cell: { flex: 1 },
  fee: { width: 90, textAlign: "right" },
  subRow: { flexDirection: "row", paddingVertical: 2, marginTop: 2 },
  subLabel: { flex: 1, textAlign: "right" },
  subVal: { width: 90, textAlign: "right" },
  note: { marginTop: 8 },
  company: { marginTop: 24, fontSize: 9, textAlign: "right" },
});

export function Receipt(props: {
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
        <Text style={s.title}>領収書</Text>
        <Text style={s.addressee}>{props.customer.name} 様</Text>
        <Text style={s.big}>{formatYen(props.tax.total)}</Text>
        <Text style={s.note}>但し、不用品回収作業費として正に受領いたしました。</Text>
        <View style={s.headRow}>
          <Text style={s.cell}>回収品目</Text>
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
            <View style={s.subRow}>
              <Text style={s.subLabel}>合計（税込）</Text>
              <Text style={s.subVal}>{formatYen(props.tax.total)}</Text>
            </View>
          </>
        ) : (
          <View style={s.subRow}>
            <Text style={s.subLabel}>（うち消費税10%）</Text>
            <Text style={s.subVal}>{formatYen(props.tax.tax)}</Text>
          </View>
        )}
        <Text style={s.note}>
          受領日: {props.date}　担当: {props.staffName}
        </Text>
        <View style={s.company}>
          <Text>{company.name}</Text>
          <Text>{company.licenseLine}</Text>
          <Text>{company.addressLine}</Text>
        </View>
      </Page>
    </Document>
  );
}

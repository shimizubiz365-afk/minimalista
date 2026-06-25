import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { company } from "@/lib/company";
import { formatYen } from "@/lib/money";
import type { TaxBreakdown, TaxMode } from "@/lib/money";
import type { SlipCustomer, CollectionLine } from "./types";

const s = StyleSheet.create({
  page: { fontFamily: "NotoSansJP", fontSize: 10, padding: 32 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 12, textAlign: "center" },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  addressee: { fontSize: 12 },
  dateText: { fontSize: 9, textAlign: "right" },
  lead: { fontSize: 10, marginTop: 4, marginBottom: 8 },
  billBox: {
    marginVertical: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F2F2EC",
    borderRadius: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  billLabel: { fontSize: 12, fontWeight: "bold" },
  billVal: { fontSize: 16, fontWeight: "bold" },
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
  totalRow: {
    flexDirection: "row",
    paddingVertical: 6,
    marginTop: 2,
    borderTop: "1pt solid #333",
  },
  totalLabel: { flex: 1, textAlign: "right", fontWeight: "bold" },
  totalVal: { width: 90, textAlign: "right", fontWeight: "bold", fontSize: 12 },
  due: { marginTop: 12, fontSize: 11, fontWeight: "bold" },
  bankBox: {
    marginTop: 8,
    padding: 10,
    border: "1pt solid #999",
    borderRadius: 4,
  },
  bankTitle: { fontSize: 10, fontWeight: "bold", marginBottom: 4 },
  bankLine: { fontSize: 10 },
  note: { marginTop: 8, fontSize: 8, color: "#555" },
  company: { marginTop: 20, fontSize: 9, textAlign: "right" },
});

export function Invoice(props: {
  customer: SlipCustomer;
  items: CollectionLine[];
  tax: TaxBreakdown;
  taxMode: TaxMode;
  date: string;
  dueDate: string;
  staffName: string;
}): React.ReactElement {
  const b = company.bank;
  return (
    <Document>
      <Page style={s.page}>
        <Text style={s.title}>請求書</Text>
        <View style={s.topRow}>
          <Text style={s.addressee}>{props.customer.name} 様</Text>
          <Text style={s.dateText}>
            請求日: {props.date}
            {"\n"}担当: {props.staffName}
          </Text>
        </View>
        <Text style={s.lead}>下記の通りご請求申し上げます。</Text>

        <View style={s.billBox}>
          <Text style={s.billLabel}>ご請求金額（税込）</Text>
          <Text style={s.billVal}>{formatYen(props.tax.total)}</Text>
        </View>

        <View style={s.headRow}>
          <Text style={s.cell}>回収品目・作業内容</Text>
          <Text style={s.fee}>金額</Text>
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
              <Text style={s.totalLabel}>合計（税込）</Text>
              <Text style={s.totalVal}>{formatYen(props.tax.total)}</Text>
            </View>
            <View style={s.subRow}>
              <Text style={s.subLabel}>（うち消費税10%）</Text>
              <Text style={s.subVal}>{formatYen(props.tax.tax)}</Text>
            </View>
          </>
        )}

        <Text style={s.due}>お支払期限: {props.dueDate}</Text>

        <View style={s.bankBox}>
          <Text style={s.bankTitle}>お振込先</Text>
          {b.configured ? (
            <>
              <Text style={s.bankLine}>
                {b.name}　{b.branch}
              </Text>
              <Text style={s.bankLine}>
                {b.type} {b.number}
              </Text>
              <Text style={s.bankLine}>名義: {b.holder}</Text>
            </>
          ) : (
            <Text style={s.bankLine}>（振込先未設定）</Text>
          )}
        </View>
        <Text style={s.note}>
          ※ お振込手数料はお客様のご負担にてお願いいたします。
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

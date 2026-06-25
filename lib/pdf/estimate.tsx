import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { company } from "@/lib/company";
import { formatYen } from "@/lib/money";
import type { SlipCustomer, CollectionLine } from "./types";

type BuyLine = { name: string; amount: number };

const s = StyleSheet.create({
  page: { fontFamily: "NotoSansJP", fontSize: 10, padding: 32 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 12, textAlign: "center" },
  addressee: { fontSize: 12, marginBottom: 4 },
  lead: { fontSize: 10, marginBottom: 8 },
  section: { fontSize: 11, fontWeight: "bold", marginTop: 14, marginBottom: 2 },
  headRow: {
    flexDirection: "row",
    borderBottom: "1pt solid #ccc",
    paddingVertical: 4,
    fontWeight: "bold",
  },
  row: { flexDirection: "row", borderBottom: "1pt solid #ccc", paddingVertical: 4 },
  cell: { flex: 1 },
  amt: { width: 100, textAlign: "right" },
  subRow: { flexDirection: "row", paddingVertical: 4 },
  subLabel: { flex: 1, textAlign: "right", fontWeight: "bold" },
  subVal: { width: 100, textAlign: "right", fontWeight: "bold" },
  netBox: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#F2F2EC",
    borderRadius: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  netLabel: { fontSize: 12, fontWeight: "bold" },
  netVal: { fontSize: 16, fontWeight: "bold" },
  note: { marginTop: 14, fontSize: 9, color: "#555" },
  meta: { marginTop: 10, fontSize: 10 },
  company: { marginTop: 20, fontSize: 9, textAlign: "right" },
});

export function Estimate(props: {
  customer: SlipCustomer;
  buyItems: BuyLine[];
  collectionItems: CollectionLine[];
  buyTotal: number;
  workTotal: number;
  net: number; // buyTotal - workTotal
  date: string;
  staffName: string;
}): React.ReactElement {
  const receive = props.net >= 0;
  return (
    <Document>
      <Page style={s.page}>
        <Text style={s.title}>お見積書</Text>
        <Text style={s.addressee}>{props.customer.name} 様</Text>
        <Text style={s.lead}>下記の通りお見積もりいたします。</Text>

        {props.buyItems.length > 0 && (
          <>
            <Text style={s.section}>■ 買取査定</Text>
            <View style={s.headRow}>
              <Text style={s.cell}>品名</Text>
              <Text style={s.amt}>査定額</Text>
            </View>
            {props.buyItems.map((it, i) => (
              <View style={s.row} key={i}>
                <Text style={s.cell}>{it.name}</Text>
                <Text style={s.amt}>{formatYen(it.amount)}</Text>
              </View>
            ))}
            <View style={s.subRow}>
              <Text style={s.subLabel}>買取査定額 合計</Text>
              <Text style={s.subVal}>{formatYen(props.buyTotal)}</Text>
            </View>
          </>
        )}

        {props.collectionItems.length > 0 && (
          <>
            <Text style={s.section}>■ 回収作業</Text>
            <View style={s.headRow}>
              <Text style={s.cell}>作業内容・品目</Text>
              <Text style={s.amt}>作業費</Text>
            </View>
            {props.collectionItems.map((it, i) => (
              <View style={s.row} key={i}>
                <Text style={s.cell}>{it.item_name}</Text>
                <Text style={s.amt}>{formatYen(it.work_fee)}</Text>
              </View>
            ))}
            <View style={s.subRow}>
              <Text style={s.subLabel}>作業費 合計</Text>
              <Text style={s.subVal}>{formatYen(props.workTotal)}</Text>
            </View>
          </>
        )}

        <View style={s.netBox}>
          <Text style={s.netLabel}>
            差引{receive ? "お客様お受取額" : "お客様お支払額"}
          </Text>
          <Text style={s.netVal}>{formatYen(Math.abs(props.net))}</Text>
        </View>

        <Text style={s.note}>
          ※ 買取査定額から回収作業費を差し引いた金額です。
          {"\n"}※ 本書はお見積もりであり、正式な買取・領収の記録ではありません。
          {"\n"}※ 本見積もりの有効期限は発行日より7日間です。
        </Text>
        <Text style={s.meta}>
          見積日: {props.date}　担当: {props.staffName}
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

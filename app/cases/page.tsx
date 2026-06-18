"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/liffClient";

type CaseRow = {
  id: string;
  status: string;
  visit_at: string | null;
  area: string | null;
  customer: { name: string; phone: string | null } | null;
};
const TABS = [
  ["reserved", "予約"],
  ["visiting", "訪問中"],
  ["visited", "訪問完了"],
] as const;

export default function CasesPage() {
  const [tab, setTab] = useState<string>("reserved");
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [err, setErr] = useState<string>();

  useEffect(() => {
    apiFetch<CaseRow[]>(`/api/cases?status=${tab}`).then((r) =>
      r.ok ? setRows(r.data ?? []) : setErr(r.error)
    );
  }, [tab]);

  return (
    <main className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold">案件一覧</h1>
        <Link href="/cases/new" className="rounded bg-black text-white px-3 py-2 text-sm">
          ＋ 予約登録
        </Link>
      </div>
      <div className="flex gap-2">
        {TABS.map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-3 py-1 rounded ${tab === v ? "bg-black text-white" : "bg-gray-200"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {err && <p className="text-red-600">{err}</p>}
      <ul className="divide-y">
        {rows.map((c) => (
          <li key={c.id}>
            <Link href={`/cases/${c.id}`} className="block py-3">
              <div className="font-medium">{c.customer?.name}</div>
              <div className="text-sm text-gray-500">
                {c.visit_at ?? "日時未定"}・{c.area ?? "エリア未定"}
              </div>
            </Link>
          </li>
        ))}
        {rows.length === 0 && !err && <li className="py-6 text-gray-400">該当なし</li>}
      </ul>
    </main>
  );
}

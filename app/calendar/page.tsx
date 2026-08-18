"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronRight as Arrow } from "lucide-react";
import { apiFetch } from "@/lib/liffClient";
import { monthGrid, groupVisitsByDay } from "@/lib/calendar";
import { staffColor } from "@/lib/staffColor";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

type CaseRow = {
  id: string;
  status: string;
  visit_at: string | null;
  registered_by: string | null;
  customer: { name: string } | null;
};
type Staff = { id: string; name: string };

const WD = ["日", "月", "火", "水", "木", "金", "土"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function timeOf(v: string | null) {
  const m = v?.match(/T?(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "";
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const [selected, setSelected] = useState(todayKey);
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  useEffect(() => {
    apiFetch<CaseRow[]>("/api/cases").then((r) => {
      if (r.ok) setRows(r.data ?? []);
    });
    apiFetch<Staff[]>("/api/staff").then((r) => {
      if (r.ok) setStaff(r.data ?? []);
    });
  }, []);

  const staffName = (id: string | null) =>
    staff.find((s) => s.id === id)?.name ?? "未割り当て";

  const byDay = useMemo(() => groupVisitsByDay(rows), [rows]);
  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const selectedVisits = byDay.get(selected) ?? [];

  function shift(delta: number) {
    let y = year;
    let m = month + delta;
    if (m < 1) {
      m = 12;
      y--;
    } else if (m > 12) {
      m = 1;
      y++;
    }
    setYear(y);
    setMonth(m);
  }

  return (
    <main className="pb-10">
      <AppHeader title="カレンダー" backHref="/" />

      {/* 月切り替え */}
      <section className="px-5 pt-5 flex items-center justify-between">
        <button
          onClick={() => shift(-1)}
          className="w-10 h-10 rounded-full flex items-center justify-center active:bg-border"
          aria-label="前の月"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold">
          {year}年{month}月
        </h2>
        <button
          onClick={() => shift(1)}
          className="w-10 h-10 rounded-full flex items-center justify-center active:bg-border"
          aria-label="次の月"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </section>

      {/* 曜日 */}
      <div className="px-3 pt-3 grid grid-cols-7 text-center text-xs text-muted">
        {WD.map((w, i) => (
          <div key={w} className={i === 0 ? "text-danger" : i === 6 ? "text-info" : ""}>
            {w}
          </div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div className="px-3 pt-1 grid grid-cols-7 gap-1">
        {grid.map((cell, i) => {
          if (!cell) return <div key={`e${i}`} />;
          const visits = byDay.get(cell.key) ?? [];
          const isToday = cell.key === todayKey;
          const isSel = cell.key === selected;
          return (
            <button
              key={cell.key}
              onClick={() => setSelected(cell.key)}
              className={[
                "aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative",
                isSel ? "bg-primary text-white" : isToday ? "bg-primary/10" : "active:bg-border/50",
              ].join(" ")}
            >
              <span className={isToday && !isSel ? "font-bold text-primary" : ""}>
                {cell.day}
              </span>
              {/* 担当者ごとの色ドット（最大4） */}
              {visits.length > 0 && (
                <span className="mt-0.5 flex gap-0.5 items-center h-1.5">
                  {visits.slice(0, 4).map((v) => (
                    <span
                      key={v.id}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: staffColor(v.registered_by) }}
                    />
                  ))}
                  {visits.length > 4 && (
                    <span className={isSel ? "text-white text-[9px]" : "text-muted text-[9px]"}>
                      +{visits.length - 4}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 選択日の訪問一覧 */}
      <section className="px-5 pt-6">
        <h3 className="text-sm font-semibold mb-3">
          {selected.replace(/-/g, "/")} の訪問{" "}
          <span className="text-muted">{selectedVisits.length}件</span>
        </h3>
        {selectedVisits.length === 0 && (
          <p className="text-sm text-subtle py-4 text-center">予定はありません</p>
        )}
        {selectedVisits.map((c) => (
          <Card key={c.id} href={`/cases/${c.id}`} className="mb-2">
            <div className="flex items-center gap-2">
              <span
                className="w-1 self-stretch rounded-full shrink-0"
                style={{ backgroundColor: staffColor(c.registered_by) }}
              />
              <span className="text-base font-semibold w-12">{timeOf(c.visit_at) || "—"}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.customer?.name ?? "（顧客未設定）"} 様</p>
                <p className="text-[11px] text-muted">{staffName(c.registered_by)}</p>
              </div>
              <StatusBadge status={c.status} />
              <Arrow className="w-4 h-4 text-subtle" />
            </div>
          </Card>
        ))}
      </section>

      {/* 担当者の色凡例 */}
      {staff.length > 0 && (
        <section className="px-5 pt-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {staff.map((s) => (
              <span key={s.id} className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: staffColor(s.id) }}
                />
                {s.name}
              </span>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

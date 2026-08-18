"use client";
import { useEffect, useRef, useState } from "react";

// 入力途中の下書きを端末内(localStorage)に保存する。
// 電話しながら入力する現場でLINEが裏に回っても入力が消えないようにするのが目的。
// サーバーには送らない＝同じ端末でのみ復元できる。写真(File)は保存できないので対象外。

const PREFIX = "genba:draft:";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 1週間で期限切れ（大昔の下書きを復活させない）

export function serializeDraft<T>(value: T, now: number): string {
  return JSON.stringify({ v: 1, at: now, data: value });
}

// 壊れている・古い・形式違いは null（＝復元しない）。安全側に倒す。
export function parseDraft<T>(
  raw: string | null,
  now: number,
  maxAgeMs: number = MAX_AGE_MS
): T | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    if (!j || j.v !== 1 || typeof j.at !== "number") return null;
    if (now - j.at > maxAgeMs) return null;
    if (j.data === undefined) return null;
    return j.data as T;
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}
function write(key: string, raw: string): void {
  try {
    localStorage.setItem(PREFIX + key, raw);
  } catch {
    // 容量超過やプライベートモード。下書きが残らないだけなので握りつぶす。
  }
}
function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // 同上
  }
}

// key を null にすると何もしない（サーバーからの読込待ちの間など）。
export function useDraft<T>(
  key: string | null,
  value: T,
  restore: (v: T) => void
): { restored: boolean; discard: () => void; clear: () => void } {
  const json = JSON.stringify(value);
  const baseline = useRef<string | null>(null);
  const [restored, setRestored] = useState(false);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  // 起動時に一度だけ。下書きがあれば復元し、無ければ「その時点の値」を基準にする。
  useEffect(() => {
    if (!key || baseline.current !== null) return;
    baseline.current = json;
    const d = parseDraft<T>(read(key), Date.now());
    if (d && JSON.stringify(d) !== json) {
      restoreRef.current(d);
      setRestored(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // 値が基準から変わっている間だけ保存する（空のまま開いただけで下書きを作らない）。
  useEffect(() => {
    if (!key || baseline.current === null || json === baseline.current) return;
    write(key, serializeDraft(JSON.parse(json) as T, Date.now()));
  }, [key, json]);

  function discard() {
    if (key) remove(key);
    if (baseline.current) restoreRef.current(JSON.parse(baseline.current) as T);
    setRestored(false);
  }
  function clear() {
    if (key) remove(key);
    setRestored(false);
  }
  return { restored, discard, clear };
}

// 選択の記憶（下書きとは別。案件ごとの税区分など「次も同じはず」の選択を端末に覚えさせる）。
// 90日で期限切れ。復元しても帯は出さない（入力内容ではなく設定なので事故にならない）。
const CHOICE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export function useStickyChoice<T>(
  key: string | null,
  initial: T
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);

  useEffect(() => {
    if (!key || loaded.current) return;
    loaded.current = true;
    const v = parseDraft<T>(read(key), Date.now(), CHOICE_MAX_AGE_MS);
    if (v !== null) setValue(v);
  }, [key]);

  function set(v: T) {
    setValue(v);
    if (key) write(key, serializeDraft(v, Date.now()));
  }
  return [value, set];
}

"use client";
import { RotateCcw } from "lucide-react";

// 「前回の入力を復元しました」の帯。復元したことを黙っていると、
// 別の顧客の入力が残っているのに気づかず送信する事故になるので必ず出す。
export function DraftBanner({ onDiscard }: { onDiscard: () => void }) {
  return (
    <div className="mx-5 mt-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 flex items-center justify-between gap-2">
      <span className="text-xs text-warning flex items-center gap-1.5">
        <RotateCcw className="w-3.5 h-3.5" /> 前回の入力内容を復元しました
      </span>
      <button
        onClick={onDiscard}
        className="text-xs font-medium text-warning underline shrink-0"
      >
        破棄して最初から
      </button>
    </div>
  );
}

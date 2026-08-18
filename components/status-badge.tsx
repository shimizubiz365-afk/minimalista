import { cn } from "@/lib/cn";
import { CASE_STATUS_LABELS, PRODUCT_STATUS_LABELS, label } from "@/lib/labels";

// 色だけを持つ。表示名は lib/labels.ts が唯一の正（二重管理で食い違うのを防ぐ）。
const CASE_STATUS: Record<string, { dot: string; text: string; pulse?: boolean }> = {
  reserved: { dot: "bg-info", text: "text-info" },
  visiting: { dot: "bg-primary", text: "text-primary", pulse: true },
  visited: { dot: "bg-success", text: "text-success" },
  pending_pickup: { dot: "bg-warning", text: "text-warning" },
  revisit: { dot: "bg-primary", text: "text-primary" },
  closed: { dot: "bg-muted", text: "text-muted" },
  cancelled: { dot: "bg-subtle", text: "text-subtle" },
};

// 商品ステータス
const PRODUCT_STATUS: Record<string, { dot: string; text: string }> = {
  in_stock: { dot: "bg-info", text: "text-info" },
  listed: { dot: "bg-warning", text: "text-warning" },
  sold: { dot: "bg-success", text: "text-success" },
};

type Props = {
  status: string;
  kind?: "case" | "product";
};

export function StatusBadge({ status, kind = "case" }: Props) {
  const map = kind === "product" ? PRODUCT_STATUS : CASE_STATUS;
  const labels = kind === "product" ? PRODUCT_STATUS_LABELS : CASE_STATUS_LABELS;
  const c = map[status] ?? { dot: "bg-subtle", text: "text-subtle" };
  const pulse = (c as { pulse?: boolean }).pulse;
  const text = label(labels, status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", c.text)}>
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          c.dot,
          pulse && "animate-pulse-dot"
        )}
      />
      {text}
    </span>
  );
}

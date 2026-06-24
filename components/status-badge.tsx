import { cn } from "@/lib/cn";

// GENBA の実ステータス語彙 → 色マップ (DB は非変更、表示のみ)
const CASE_STATUS: Record<
  string,
  { label: string; dot: string; text: string; pulse?: boolean }
> = {
  reserved: { label: "予約", dot: "bg-info", text: "text-info" },
  visiting: { label: "訪問中", dot: "bg-primary", text: "text-primary", pulse: true },
  visited: { label: "訪問完了", dot: "bg-success", text: "text-success" },
  closed: { label: "精算済み", dot: "bg-muted", text: "text-muted" },
  canceled: { label: "キャンセル", dot: "bg-subtle", text: "text-subtle" },
};

// 商品ステータス
const PRODUCT_STATUS: Record<
  string,
  { label: string; dot: string; text: string }
> = {
  in_stock: { label: "在庫", dot: "bg-info", text: "text-info" },
  listed: { label: "出品中", dot: "bg-warning", text: "text-warning" },
  sold: { label: "売約", dot: "bg-success", text: "text-success" },
};

type Props = {
  status: string;
  kind?: "case" | "product";
};

export function StatusBadge({ status, kind = "case" }: Props) {
  const map = kind === "product" ? PRODUCT_STATUS : CASE_STATUS;
  const c = map[status] ?? { label: status, dot: "bg-subtle", text: "text-subtle" };
  const pulse = (c as { pulse?: boolean }).pulse;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", c.text)}>
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          c.dot,
          pulse && "animate-pulse-dot"
        )}
      />
      {c.label}
    </span>
  );
}

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

// 共通ローディングマーク（くるくる回る）
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin", className)} aria-hidden />;
}

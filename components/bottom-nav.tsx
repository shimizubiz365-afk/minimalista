"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, ClipboardList, Calendar, Settings } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/", label: "ホーム", icon: Home, match: (p: string) => p === "/" },
  {
    href: "/cases",
    label: "案件",
    icon: ClipboardList,
    match: (p: string) => p.startsWith("/cases"),
  },
  {
    href: "/calendar",
    label: "カレンダー",
    icon: Calendar,
    match: (p: string) => p.startsWith("/calendar"),
  },
  {
    href: "/settings",
    label: "設定",
    icon: Settings,
    match: (p: string) => p.startsWith("/settings") || p.startsWith("/fees"),
  },
];

export function BottomNav() {
  const pathname = usePathname() || "/";

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-surface border-t border-border h-16 flex items-center justify-around z-20">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              active ? "text-primary" : "text-subtle"
            )}
          >
            <Icon className="w-5 h-5" />
            <span className={cn("text-[10px]", active && "font-medium")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

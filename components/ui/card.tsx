import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  href?: string;
  className?: string;
  children: React.ReactNode;
};

export function Card({ href, className, children }: Props) {
  const cls = cn(
    "block bg-surface rounded-lg border border-border p-4 shadow-sm-soft",
    href && "card-tap cursor-pointer",
    className
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return <div className={cls}>{children}</div>;
}

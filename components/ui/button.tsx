import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-white active:bg-primary/90",
  secondary: "border border-border bg-surface text-fg active:bg-border/40",
  ghost: "text-fg active:bg-border/40",
  danger: "bg-danger text-white active:bg-danger/90",
};

const SIZES: Record<Size, string> = {
  md: "h-12 text-base",
  lg: "h-14 text-base",
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      className={cn(
        "w-full rounded-md font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

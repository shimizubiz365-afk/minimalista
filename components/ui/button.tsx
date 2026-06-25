import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

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
  loading?: boolean;
  loadingText?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  loading = false,
  loadingText,
  disabled,
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
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner className="w-5 h-5" />
          {loadingText ?? "処理中..."}
        </>
      ) : (
        children
      )}
    </button>
  );
}

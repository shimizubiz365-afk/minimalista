import { cn } from "@/lib/cn";

export const inputClass =
  "w-full border border-border rounded-md px-3 h-12 bg-surface text-fg placeholder:text-subtle focus:outline-none focus:border-primary";

export const textareaClass =
  "w-full border border-border rounded-md px-3 py-2 bg-surface text-fg placeholder:text-subtle focus:outline-none focus:border-primary";

type FieldProps = {
  label?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Field({ label, required, className, children }: FieldProps) {
  return (
    <div className={cn("block", className)}>
      {label && (
        <span className="text-sm text-muted mb-1 block">
          {label}
          {required && <span className="text-accent"> *</span>}
        </span>
      )}
      {children}
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = {
  title?: string;
  backHref?: string;
  showLogo?: boolean;
  right?: React.ReactNode;
};

export function AppHeader({ title, backHref, showLogo, right }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border h-14 flex items-center justify-between px-4">
      <div className="flex items-center gap-2 min-w-0">
        {backHref ? (
          <Link
            href={backHref}
            className="w-10 h-10 flex items-center justify-center -ml-2 rounded-full active:bg-border"
            aria-label="戻る"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        ) : null}
        {showLogo && (
          <>
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="font-semibold tracking-wide text-[15px]">
              MINIMALISTA
            </span>
          </>
        )}
        {title && <h1 className="text-base font-semibold truncate">{title}</h1>}
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </header>
  );
}

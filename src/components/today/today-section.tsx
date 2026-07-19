import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Shared shell for a Today section: heading, optional count, and a link out to
 * the full module page.
 */
export function TodaySection({
  title,
  count,
  href,
  linkLabel,
  children,
}: {
  title: string;
  count?: number;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">
          {title}
          {count !== undefined && count > 0 ? (
            <span className="text-muted-foreground ml-2 text-xs font-normal tabular-nums">
              {count}
            </span>
          ) : null}
        </h2>
        <Link
          href={href}
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium"
        >
          {linkLabel}
          <ArrowRight className="size-3" />
        </Link>
      </div>
      {children}
    </section>
  );
}

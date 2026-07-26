"use client";

import { cn } from "@/lib/utils";
import { useIsTruncated } from "@/hooks/use-is-truncated";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function TruncatedText({
  text,
  className,
  as: Tag = "span",
  interactive = true,
}: {
  text: string;
  className?: string;
  as?: "span" | "p";
  /**
   * When true (default), a truncated value reveals its full text via a styled
   * tooltip (hover) and a popover (tap) — use for standalone text.
   *
   * Set false when this text sits inside another interactive element (a row
   * button, a link, a filter chip). Then the reveal is hover-tooltip only, the
   * trigger is not a separate tab stop, and taps pass through to the parent's
   * own action (edit / navigate / filter) instead of being intercepted.
   */
  interactive?: boolean;
}) {
  const { ref, truncated } = useIsTruncated<HTMLElement>();
  // Identical width-affecting classes across every branch keep the measured
  // width stable, so the truncated state can't oscillate.
  const textClass = cn("block truncate", className);

  if (!truncated) {
    return (
      <Tag ref={ref} className={textClass}>
        {text}
      </Tag>
    );
  }

  if (!interactive) {
    // Nested inside an interactive parent: hover tooltip only. The trigger is
    // non-focusable (tabIndex -1) so it adds no second tab stop, and it does
    // not intercept clicks — the parent's action stays the tap target.
    return (
      <Tooltip>
        <TooltipTrigger
          render={<Tag ref={ref} tabIndex={-1} className={textClass} />}
        >
          {text}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs whitespace-pre-wrap break-words">
          {text}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              nativeButton={false}
              render={
                <Tag
                  ref={ref}
                  title={text}
                  className={cn(textClass, "cursor-pointer text-left")}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                    }
                  }}
                />
              }
            />
          }
        >
          {text}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs whitespace-pre-wrap break-words">
          {text}
        </TooltipContent>
      </Tooltip>
      <PopoverContent>{text}</PopoverContent>
    </Popover>
  );
}

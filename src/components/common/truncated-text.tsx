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
}: {
  text: string;
  className?: string;
  as?: "span" | "p";
}) {
  const { ref, truncated } = useIsTruncated<HTMLElement>();
  // Identical classes in both branches keep the measured width stable.
  const textClass = cn("block truncate", className);

  if (!truncated) {
    return (
      <Tag ref={ref} className={textClass}>
        {text}
      </Tag>
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

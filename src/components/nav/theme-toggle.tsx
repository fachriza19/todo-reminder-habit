"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMounted } from "@/hooks/use-is-mounted";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useIsMounted();

  // Before mount, resolvedTheme is unknown on the client — render a stable,
  // theme-agnostic label + icon so the first client render matches the server
  // HTML (avoids a hydration mismatch on aria-label). Swap after mount.
  const isDark = resolvedTheme === "dark";
  const label = !mounted
    ? "Toggle theme"
    : isDark
      ? "Switch to light mode"
      : "Switch to dark mode";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          />
        }
      >
        {mounted && isDark ? (
          <Sun className="size-4" />
        ) : (
          <Moon className="size-4" />
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

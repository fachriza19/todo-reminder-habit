"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { useIsMounted } from "@/hooks/use-is-mounted";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const mounted = useIsMounted();
  // Until mounted the theme is unknown on the client — treat nothing as selected
  // so the first render matches the server (avoids a hydration mismatch).
  const current = mounted ? theme : undefined;

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="bg-muted inline-flex gap-1 rounded-lg p-1"
    >
      {OPTIONS.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(opt.value)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <opt.icon className="size-4" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

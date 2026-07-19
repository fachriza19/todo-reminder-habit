import { Check } from "lucide-react";

export function TodayEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <div className="bg-success/10 text-success flex size-12 items-center justify-center rounded-full">
        <Check className="size-6" />
      </div>
      <div>
        <p className="font-medium">You&rsquo;re all set for today</p>
        <p className="text-muted-foreground max-w-xs text-sm">
          Nothing needs your attention right now.
        </p>
      </div>
    </div>
  );
}

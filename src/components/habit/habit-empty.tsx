import { Flame } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HabitEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <Flame className="size-6" />
      </div>
      <div>
        <p className="font-medium">No habits yet</p>
        <p className="text-muted-foreground max-w-xs text-sm">
          Build a streak. Start with one small daily target.
        </p>
      </div>
      <Button onClick={onAdd}>Add your first habit</Button>
    </div>
  );
}

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReminderEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        <Bell className="size-6" />
      </div>
      <div>
        <p className="font-medium">No reminders yet</p>
        <p className="text-muted-foreground max-w-xs text-sm">
          Add one and it’ll light up here when it’s due.
        </p>
      </div>
      <Button onClick={onAdd}>Add your first reminder</Button>
    </div>
  );
}

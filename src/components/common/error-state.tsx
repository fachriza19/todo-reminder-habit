import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Couldn't load this",
  message = "Something went wrong on our end.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
      <AlertCircle className="text-muted-foreground size-6" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

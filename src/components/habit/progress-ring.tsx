import { cn } from "@/lib/utils";

/**
 * Circular progress indicator (F-HAB-4). Fills clockwise; turns success-colored
 * when complete. Purely presentational.
 */
export function ProgressRing({
  value,
  max,
  size = 56,
  strokeWidth = 5,
  color,
  className,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string | null;
  className?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max <= 0 ? 0 : Math.min(1, value / max);
  const complete = value >= max && max > 0;
  const offset = circumference * (1 - ratio);
  const stroke = complete ? "var(--success)" : (color ?? "var(--primary)");

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-300 motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

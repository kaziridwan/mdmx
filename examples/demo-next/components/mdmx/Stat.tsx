import { defineMDMX } from "@mdmx/core";
import { cn } from "@/lib/utils";

interface StatProps {
  /** The headline number, preformatted */
  value: string;
  label: string;
  trend?: "up" | "down" | "flat";
  delta?: number;
}

const TREND = { up: "▲", down: "▼", flat: "—" } as const;

function StatImpl({ value, label, trend, delta }: StatProps) {
  return (
    <div className="flex w-fit min-w-40 flex-col items-start gap-0.5 rounded-xl border bg-card px-4 py-3 text-left">
      <span className="font-heading text-2xl font-semibold text-primary tabular-nums">{value}</span>
      <span className="text-xs tracking-wider text-muted-foreground uppercase">{label}</span>
      {trend || delta != null ? (
        <span
          className={cn(
            "mt-1 text-xs font-medium",
            trend === "up" && "text-emerald-600",
            trend === "down" && "text-destructive",
            (!trend || trend === "flat") && "text-muted-foreground",
          )}
        >
          {trend ? TREND[trend] : null} {delta != null ? `${delta > 0 ? "+" : ""}${delta}` : null}
        </span>
      ) : null}
    </div>
  );
}

export const Stat = defineMDMX(StatImpl, {
  name: "Stat",
  category: "Data",
  icon: "trending-up",
  description: "A single headline metric",
});

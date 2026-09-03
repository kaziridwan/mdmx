import { defineMDMX } from "@mdmx/core";
import { cn } from "@/lib/utils";

interface StatProps {
  /** The headline number, preformatted */
  value?: string;
  label?: string;
  trend?: "up" | "down" | "flat";
  delta?: number;
}

const TREND = { up: "▲", down: "▼", flat: "—" } as const;

function StatImpl({ value = "0", label = "Label", trend, delta }: StatProps) {
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
  props: {
    value: { placeholder: "27ms", default: "0" },
    label: { placeholder: "What the number measures", default: "Label" },
    trend: { control: { type: "select", options: ["up", "down", "flat"] } },
    delta: { control: { type: "number", step: 0.1 } },
  },
  preview: { value: "27ms", label: "median save-to-commit", trend: "up", delta: 4 },
});

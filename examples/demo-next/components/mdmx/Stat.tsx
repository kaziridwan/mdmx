import { defineMDMX } from "@mdmx/core";

interface StatProps {
  /** The headline number, preformatted */
  value: string;
  label: string;
  trend?: "up" | "down" | "flat";
  delta?: number;
}

function StatImpl({ value, label }: StatProps) {
  return (
    <figure>
      <span>{value}</span>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export const Stat = defineMDMX(StatImpl, {
  name: "Stat",
  category: "Data",
  icon: "trending-up",
  description: "A single headline metric",
});

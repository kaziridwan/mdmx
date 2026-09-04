import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";
import { cn } from "@/lib/utils";

interface PricingTableProps {
  columns?: "2" | "3" | "4";
  children: ReactNode;
}

const COLUMNS = {
  "2": "@md:grid-cols-2",
  "3": "@md:grid-cols-2 @5xl:grid-cols-3",
  "4": "@md:grid-cols-2 @5xl:grid-cols-4",
} as const;

function PricingTableImpl({ columns = "3", children }: PricingTableProps) {
  return (
    <section data-columns={columns} className={cn("grid grid-cols-1 gap-4", COLUMNS[columns] ?? COLUMNS["3"])}>
      {children}
    </section>
  );
}

export const PricingTable = defineMDMX(PricingTableImpl, {
  name: "PricingTable",
  category: "Marketing",
  icon: "credit-card",
  description: "A row of pricing tiers",
  children: "blocks",
  constraints: { allowedChildren: ["PricingTier"] },
  props: {
    columns: { control: { type: "select", options: ["2", "3", "4"] }, default: "3" },
  },
});

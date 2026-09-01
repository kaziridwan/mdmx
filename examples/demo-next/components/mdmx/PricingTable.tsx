import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";

function PricingTableImpl({ children }: { children: ReactNode }) {
  return <section className="grid grid-cols-1 gap-4 @md:grid-cols-2 @5xl:grid-cols-3">{children}</section>;
}

export const PricingTable = defineMDMX(PricingTableImpl, {
  name: "PricingTable",
  category: "Marketing",
  icon: "credit-card",
  description: "A row of pricing tiers",
  children: "blocks",
  constraints: { allowedChildren: ["PricingTier"] },
});

import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";

function PricingTableImpl({ children }: { children: ReactNode }) {
  return <section className="mk-pricing">{children}</section>;
}

export const PricingTable = defineMDMX(PricingTableImpl, {
  name: "PricingTable",
  category: "Marketing",
  icon: "credit-card",
  description: "A row of pricing tiers",
  children: "blocks",
  constraints: { allowedChildren: ["PricingTier"] },
});

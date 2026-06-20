import type { ReactNode } from "react";
import { defineIMDX } from "@imdx/core";

function PricingTableImpl({ children }: { children: ReactNode }) {
  return <section className="mk-pricing">{children}</section>;
}

export const PricingTable = defineIMDX(PricingTableImpl, {
  name: "PricingTable",
  category: "Marketing",
  icon: "credit-card",
  description: "A row of pricing tiers",
  children: "blocks",
  constraints: { allowedChildren: ["PricingTier"] },
});

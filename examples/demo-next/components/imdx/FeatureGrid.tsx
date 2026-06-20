import type { ReactNode } from "react";
import { defineIMDX } from "@imdx/core";

interface FeatureGridProps {
  columns?: "2" | "3" | "4";
  children: ReactNode;
}

function FeatureGridImpl({ columns = "3", children }: FeatureGridProps) {
  return (
    <section className="mk-features" data-columns={columns}>
      {children}
    </section>
  );
}

export const FeatureGrid = defineIMDX(FeatureGridImpl, {
  name: "FeatureGrid",
  category: "Marketing",
  icon: "grid",
  description: "A responsive grid of Feature cards",
  children: "blocks",
  constraints: { allowedChildren: ["Feature"] },
  props: {
    columns: { default: "3" },
  },
});

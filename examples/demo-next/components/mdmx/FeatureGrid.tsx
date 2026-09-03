import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";
import { cn } from "@/lib/utils";

interface FeatureGridProps {
  columns?: "2" | "3" | "4";
  children: ReactNode;
}

// Grid, not flex: the editor wraps each child block, and grid auto-placement
// treats those wrappers as items with nothing to configure per child.
const COLUMNS = {
  "2": "@md:grid-cols-2",
  "3": "@md:grid-cols-2 @3xl:grid-cols-3",
  "4": "@md:grid-cols-2 @3xl:grid-cols-4",
} as const;

function FeatureGridImpl({ columns = "3", children }: FeatureGridProps) {
  return (
    <section data-columns={columns} className={cn("grid grid-cols-1 gap-4", COLUMNS[columns])}>
      {children}
    </section>
  );
}

export const FeatureGrid = defineMDMX(FeatureGridImpl, {
  name: "FeatureGrid",
  category: "Marketing",
  icon: "grid",
  description: "A responsive grid of Feature cards",
  children: "blocks",
  constraints: { allowedChildren: ["Feature"] },
  props: {
    columns: { control: { type: "select", options: ["2", "3", "4"] }, default: "3" },
  },
});

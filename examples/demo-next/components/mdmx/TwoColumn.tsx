import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";
import { cn } from "@/lib/utils";

interface TwoColumnProps {
  /** Width ratio of the two columns */
  ratio?: "1:1" | "1:2" | "2:1";
  children: ReactNode;
}

// Grid, not flex: grid auto-placement treats the editor's block wrappers as
// items with nothing to configure per child (no `> *` sizing needed).
const RATIOS = {
  "1:1": "@md:grid-cols-2",
  "1:2": "@md:grid-cols-[1fr_2fr]",
  "2:1": "@md:grid-cols-[2fr_1fr]",
} as const;

function TwoColumn({ ratio = "1:1", children }: TwoColumnProps) {
  return (
    <div data-ratio={ratio} className={cn("grid grid-cols-1 gap-6", RATIOS[ratio] ?? RATIOS["1:1"])}>
      {children}
    </div>
  );
}

export default defineMDMX(TwoColumn, {
  name: "TwoColumn",
  category: "Layout",
  icon: "columns",
  description: "Two side-by-side columns",
  children: "blocks",
  constraints: { allowedChildren: ["Column"] },
  props: {
    ratio: { control: { type: "select", options: ["1:1", "1:2", "2:1"] }, default: "1:1" },
  },
});

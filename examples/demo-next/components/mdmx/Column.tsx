import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";

function Column({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}

export default defineMDMX(Column, {
  name: "Column",
  category: "Layout",
  icon: "square",
  description: "A column inside TwoColumn",
  children: "blocks",
  constraints: { allowedParents: ["TwoColumn"] },
});

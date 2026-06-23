import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";

function TwoColumn({ children }: { children: ReactNode }) {
  return <div className="twocol">{children}</div>;
}

export default defineMDMX(TwoColumn, {
  name: "TwoColumn",
  category: "Layout",
  icon: "columns",
  description: "Two side-by-side columns",
  children: "blocks",
  constraints: { allowedChildren: ["Column"] },
});

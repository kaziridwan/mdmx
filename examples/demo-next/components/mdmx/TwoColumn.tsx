import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";

// Grid, not flex: grid auto-placement treats the editor's block wrappers as
// items with nothing to configure per child (no `> *` sizing needed).
function TwoColumn({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-6 @md:grid-cols-2">{children}</div>;
}

export default defineMDMX(TwoColumn, {
  name: "TwoColumn",
  category: "Layout",
  icon: "columns",
  description: "Two side-by-side columns",
  children: "blocks",
  constraints: { allowedChildren: ["Column"] },
});

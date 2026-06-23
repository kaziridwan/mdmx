import type { ReactNode } from "react";
import { defineIMDX } from "@imdx/core";

function TwoColumn({ children }: { children: ReactNode }) {
  return <div className="twocol">{children}</div>;
}

export default defineIMDX(TwoColumn, {
  name: "TwoColumn",
  category: "Layout",
  icon: "columns",
  description: "Two side-by-side columns",
  children: "blocks",
  constraints: { allowedChildren: ["Column"] },
});

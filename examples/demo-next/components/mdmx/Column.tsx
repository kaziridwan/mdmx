import type { ReactNode } from "react";
import { defineIMDX } from "@imdx/core";

function Column({ children }: { children: ReactNode }) {
  return <div className="col">{children}</div>;
}

export default defineIMDX(Column, {
  name: "Column",
  category: "Layout",
  icon: "square",
  description: "A column inside TwoColumn",
  children: "blocks",
  constraints: { allowedParents: ["TwoColumn"] },
});

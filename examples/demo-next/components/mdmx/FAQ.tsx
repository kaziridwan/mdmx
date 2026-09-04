import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";

// Items are self-contained collapsibles (each block is its own React tree in
// the editor, so no shared accordion context); the list only draws dividers.
function FAQImpl({ children }: { children: ReactNode }) {
  return <section className="flex flex-col divide-y rounded-lg border px-4">{children}</section>;
}

export const FAQ = defineMDMX(FAQImpl, {
  name: "FAQ",
  category: "Marketing",
  icon: "help-circle",
  description: "A list of question/answer items",
  children: "blocks",
  constraints: { allowedChildren: ["FAQItem"] },
});

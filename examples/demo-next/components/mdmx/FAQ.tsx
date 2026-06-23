import type { ReactNode } from "react";
import { defineIMDX } from "@imdx/core";

function FAQImpl({ children }: { children: ReactNode }) {
  return <section className="mk-faq">{children}</section>;
}

export const FAQ = defineIMDX(FAQImpl, {
  name: "FAQ",
  category: "Marketing",
  icon: "help-circle",
  description: "A list of question/answer items",
  children: "blocks",
  constraints: { allowedChildren: ["FAQItem"] },
});

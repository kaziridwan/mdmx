import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";

interface FAQItemProps {
  question: string;
  /** The answer, edited inline */
  children: ReactNode;
}

function FAQItemImpl({ question, children }: FAQItemProps) {
  return (
    <div className="mk-faq-item">
      <p className="mk-faq-q">{question}</p>
      <div className="mk-faq-a">{children}</div>
    </div>
  );
}

export const FAQItem = defineMDMX(FAQItemImpl, {
  name: "FAQItem",
  category: "Marketing",
  icon: "help-circle",
  description: "One question/answer inside an FAQ",
  children: "rich-text",
  constraints: { allowedParents: ["FAQ"] },
  props: {
    question: { placeholder: "Frequently asked question?" },
  },
});

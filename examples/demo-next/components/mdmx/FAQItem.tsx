import type { ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { defineMDMX } from "@mdmx/core";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface FAQItemProps {
  question: string;
  /** Start expanded */
  open?: boolean;
  /** The answer, edited inline */
  children: ReactNode;
}

function FAQItemImpl({ question, open = true, children }: FAQItemProps) {
  return (
    <Collapsible defaultOpen={open} className="group/faq py-3">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 text-left font-heading font-semibold hover:underline">
        {question}
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-open/faq:rotate-180" />
      </CollapsibleTrigger>
      {/* keepMounted: the editable answer must stay in the DOM while collapsed. */}
      <CollapsibleContent keepMounted className="pt-2 text-[15px] text-muted-foreground">
        {children}
      </CollapsibleContent>
    </Collapsible>
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
    open: { default: true },
  },
});

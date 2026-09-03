import type { ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { defineMDMX } from "@mdmx/core";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AccordionItemProps {
  title?: string;
  /** Start expanded */
  open?: boolean;
  children: ReactNode;
}

function AccordionItemImpl({ title = "Section", open = false, children }: AccordionItemProps) {
  return (
    <Collapsible defaultOpen={open} className="group/acc">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 py-2.5 text-left text-sm font-medium hover:underline">
        {title}
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-open/acc:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent keepMounted className="pb-2.5 text-sm">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export const AccordionItem = defineMDMX(AccordionItemImpl, {
  name: "AccordionItem",
  category: "UI",
  icon: "chevron-down",
  description: "One expandable section inside an Accordion",
  children: "blocks",
  constraints: { allowedParents: ["Accordion"] },
  props: {
    title: { placeholder: "Section title", default: "Section" },
    open: { default: false },
  },
  preview: { title: "What is a block?", children: "A registered component the editor can insert." },
});

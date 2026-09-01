import type { ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { defineMDMX } from "@mdmx/core";
import { Collapsible as UICollapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CollapsibleProps {
  /** The toggle's label */
  title: string;
  /** Start expanded */
  open?: boolean;
  children: ReactNode;
}

function CollapsibleImpl({ title, open = false, children }: CollapsibleProps) {
  return (
    <UICollapsible defaultOpen={open} className="group/collapsible rounded-lg border px-3 py-2">
      <CollapsibleTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full justify-between px-1")}>
        {title}
        <ChevronDownIcon className="size-4 transition-transform group-data-open/collapsible:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent keepMounted className="px-1 pt-2 pb-1">
        {children}
      </CollapsibleContent>
    </UICollapsible>
  );
}

export const Collapsible = defineMDMX(CollapsibleImpl, {
  name: "Collapsible",
  category: "UI",
  icon: "chevrons-up-down",
  description: "A section that folds away behind a toggle",
  children: "blocks",
  props: {
    title: { placeholder: "Show details" },
    open: { default: false },
  },
});

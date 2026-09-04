import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";

// A list of AccordionItem blocks. Each item is a self-contained collapsible
// (blocks are separate React trees in the editor, so there is no shared
// accordion context); the list draws the dividers.
function AccordionImpl({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-col divide-y">{children}</div>;
}

export const Accordion = defineMDMX(AccordionImpl, {
  name: "Accordion",
  category: "UI",
  icon: "chevrons-down-up",
  description: "Stacked, expandable sections (holds AccordionItem blocks)",
  children: "blocks",
  constraints: { allowedChildren: ["AccordionItem"] },
});

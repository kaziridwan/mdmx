import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TooltipProps {
  /** The tooltip text */
  content: string;
  side?: "top" | "bottom" | "left" | "right";
  /** The text that shows the tooltip, edited inline */
  children: ReactNode;
}

// The trigger renders as a span so the inline-editable children stay plain
// text; the tooltip text is a prop because a popup unmounts when closed.
function TooltipImpl({ content, side = "top", children }: TooltipProps) {
  return (
    <UITooltip>
      <TooltipTrigger render={<span className="underline decoration-dotted underline-offset-4" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </UITooltip>
  );
}

export const Tooltip = defineMDMX(TooltipImpl, {
  name: "Tooltip",
  category: "UI",
  icon: "info",
  description: "Text with a tooltip on hover",
  children: "rich-text",
  props: {
    content: { placeholder: "Helpful detail" },
    side: { default: "top" },
  },
  preview: { content: "A tooltip", children: "Hover me" },
});

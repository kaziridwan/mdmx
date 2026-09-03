import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TooltipProps {
  /** The tooltip text */
  content?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** Distance from the trigger, in pixels */
  sideOffset?: number;
  /** The text that shows the tooltip, edited inline */
  children: ReactNode;
}

// The trigger renders as a span so the inline-editable children stay plain
// text; the tooltip text is a prop because a popup unmounts when closed.
function TooltipImpl({ content = "Tooltip", side = "top", align = "center", sideOffset = 4, children }: TooltipProps) {
  return (
    <UITooltip>
      <TooltipTrigger render={<span className="underline decoration-dotted underline-offset-4" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} align={align} sideOffset={sideOffset}>
        {content}
      </TooltipContent>
    </UITooltip>
  );
}

export const Tooltip = defineMDMX(TooltipImpl, {
  name: "Tooltip",
  category: "UI",
  icon: "info",
  description: "Text with a tooltip on hover",
  children: "rich-text",
  // The popup only shows on hover: every event is the component's (Alt-click selects).
  render: { interactive: true },
  props: {
    content: { placeholder: "Helpful detail", default: "Tooltip" },
    side: { control: { type: "select", options: ["top", "right", "bottom", "left"] }, default: "top" },
    align: { control: { type: "select", options: ["start", "center", "end"] }, default: "center" },
    sideOffset: { control: { type: "number", min: 0, max: 32, step: 1 }, default: 4 },
  },
  preview: { content: "A tooltip", children: "Hover me" },
});

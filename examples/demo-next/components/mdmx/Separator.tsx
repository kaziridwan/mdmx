import { defineMDMX } from "@mdmx/core";
import { Separator as UISeparator } from "@/components/ui/separator";

interface SeparatorProps {
  /** Optional centered label */
  label?: string;
  orientation?: "horizontal" | "vertical";
}

function SeparatorImpl({ label, orientation = "horizontal" }: SeparatorProps) {
  if (orientation === "vertical") {
    return (
      <div className="flex justify-center py-1">
        <UISeparator orientation="vertical" className="h-8" />
      </div>
    );
  }
  if (!label) return <UISeparator />;
  return (
    <div className="flex items-center gap-3">
      <UISeparator className="flex-1" />
      <span className="text-xs tracking-wider text-muted-foreground uppercase">{label}</span>
      <UISeparator className="flex-1" />
    </div>
  );
}

export const Separator = defineMDMX(SeparatorImpl, {
  name: "Separator",
  category: "UI",
  icon: "minus",
  description: "A horizontal rule, optionally labeled",
  props: {
    label: { placeholder: "or", showIf: { prop: "orientation", eq: "horizontal" } },
    orientation: { control: { type: "select", options: ["horizontal", "vertical"] }, default: "horizontal" },
  },
});

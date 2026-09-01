import { defineMDMX } from "@mdmx/core";
import { Separator as UISeparator } from "@/components/ui/separator";

interface SeparatorProps {
  /** Optional centered label */
  label?: string;
}

function SeparatorImpl({ label }: SeparatorProps) {
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
    label: { placeholder: "or" },
  },
});

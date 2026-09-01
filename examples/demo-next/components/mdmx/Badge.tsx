import { defineMDMX } from "@mdmx/core";
import { Badge as UIBadge } from "@/components/ui/badge";

interface BadgeProps {
  label: string;
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost";
}

function BadgeImpl({ label, variant = "default" }: BadgeProps) {
  return <UIBadge variant={variant}>{label}</UIBadge>;
}

export const Badge = defineMDMX(BadgeImpl, {
  name: "Badge",
  category: "UI",
  icon: "tag",
  description: "A small status label",
  props: {
    label: { placeholder: "New" },
    variant: { default: "default" },
  },
  preview: { label: "New" },
});

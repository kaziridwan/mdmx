import { defineMDMX } from "@mdmx/core";
import { Badge as UIBadge } from "@/components/ui/badge";

interface BadgeProps {
  label?: string;
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";
  /** Makes the badge a link */
  href?: string;
}

function BadgeImpl({ label = "New", variant = "default", href }: BadgeProps) {
  if (href) {
    return (
      <UIBadge variant={variant} render={<a href={href} />}>
        {label}
      </UIBadge>
    );
  }
  return <UIBadge variant={variant}>{label}</UIBadge>;
}

export const Badge = defineMDMX(BadgeImpl, {
  name: "Badge",
  category: "UI",
  icon: "tag",
  description: "A small status label, optionally linking somewhere",
  props: {
    label: { placeholder: "New", default: "New" },
    variant: {
      control: { type: "select", options: ["default", "secondary", "destructive", "outline", "ghost", "link"] },
      default: "default",
    },
    href: { control: { type: "link" }, placeholder: "/changelog" },
  },
  preview: { label: "New" },
});

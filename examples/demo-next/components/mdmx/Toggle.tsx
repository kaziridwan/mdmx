import { defineMDMX } from "@mdmx/core";
import { Toggle as UIToggle } from "@/components/ui/toggle";

interface ToggleProps {
  label?: string;
  /** Start pressed */
  pressed?: boolean;
  variant?: "default" | "outline";
  size?: "sm" | "default" | "lg";
}

function ToggleImpl({ label = "Toggle", pressed = false, variant = "outline", size = "default" }: ToggleProps) {
  return (
    <UIToggle defaultPressed={pressed} variant={variant} size={size} aria-label={label}>
      {label}
    </UIToggle>
  );
}

export const Toggle = defineMDMX(ToggleImpl, {
  name: "Toggle",
  category: "UI",
  icon: "toggle-left",
  description: "A two-state button",
  props: {
    label: { placeholder: "Bold", default: "Toggle" },
    pressed: { default: false },
    variant: { control: { type: "select", options: ["default", "outline"] }, default: "outline" },
    size: { control: { type: "select", options: ["sm", "default", "lg"] }, default: "default" },
  },
  preview: { label: "Toggle me" },
});

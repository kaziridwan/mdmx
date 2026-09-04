import { defineMDMX } from "@mdmx/core";
import { Button as UIButton, buttonVariants } from "@/components/ui/button";

interface ButtonProps {
  label?: string;
  /** Where the button links to; leave empty for a plain button */
  href?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  size?: "sm" | "default" | "lg";
}

function ButtonImpl({ label = "Button", href, variant = "default", size = "default" }: ButtonProps) {
  if (href) {
    return (
      <a className={buttonVariants({ variant, size })} href={href}>
        {label}
      </a>
    );
  }
  return (
    <UIButton variant={variant} size={size} type="button">
      {label}
    </UIButton>
  );
}

export const Button = defineMDMX(ButtonImpl, {
  name: "Button",
  category: "UI",
  icon: "mouse-pointer-click",
  description: "A button, optionally linking somewhere",
  props: {
    label: { placeholder: "Click me", default: "Button" },
    href: { control: { type: "link" }, placeholder: "/docs" },
    variant: {
      control: { type: "select", options: ["default", "outline", "secondary", "ghost", "destructive", "link"] },
      default: "default",
    },
    size: { control: { type: "select", options: ["sm", "default", "lg"] }, default: "default" },
  },
  preview: { label: "Get started" },
});

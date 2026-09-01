import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CallToActionProps {
  heading: string;
  buttonLabel: string;
  buttonHref: string;
  variant?: "solid" | "soft";
  /** Supporting copy, edited inline */
  children: ReactNode;
}

function CallToActionImpl({
  heading,
  buttonLabel,
  buttonHref,
  variant = "solid",
  children,
}: CallToActionProps) {
  const solid = variant === "solid";
  return (
    <section
      data-variant={variant}
      className={cn(
        "flex flex-wrap items-center justify-between gap-6 rounded-2xl px-8 py-7",
        solid ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
      )}
    >
      <div className="min-w-0 flex-1 basis-64">
        <h2 className="font-heading mt-0 mb-1.5 text-xl font-semibold">{heading}</h2>
        <div className={cn("text-base", solid ? "opacity-90" : "text-muted-foreground")}>{children}</div>
      </div>
      <a
        className={cn(buttonVariants({ variant: solid ? "secondary" : "default", size: "lg" }), "whitespace-nowrap")}
        href={buttonHref}
      >
        {buttonLabel}
      </a>
    </section>
  );
}

export const CallToAction = defineMDMX(CallToActionImpl, {
  name: "CallToAction",
  category: "Marketing",
  icon: "megaphone",
  description: "Banner with a heading, supporting text, and one action button",
  children: "rich-text",
  props: {
    heading: { placeholder: "Ready to start?" },
    buttonLabel: { placeholder: "Button text" },
    buttonHref: { control: { type: "link" } },
    variant: { default: "solid" },
  },
  preview: {
    heading: "Ready to dive in?",
    buttonLabel: "Start now",
    buttonHref: "#",
    variant: "solid",
    children: "Start authoring with your own components today.",
  },
});

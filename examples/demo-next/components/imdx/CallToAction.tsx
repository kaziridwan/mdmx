import type { ReactNode } from "react";
import { defineIMDX } from "@imdx/core";

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
  return (
    <section className="mk-cta" data-variant={variant}>
      <div className="mk-cta-body">
        <h2 className="mk-cta-heading">{heading}</h2>
        <div className="mk-cta-copy">{children}</div>
      </div>
      <a className="mk-btn mk-btn-primary" href={buttonHref}>
        {buttonLabel}
      </a>
    </section>
  );
}

export const CallToAction = defineIMDX(CallToActionImpl, {
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

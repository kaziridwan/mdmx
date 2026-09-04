import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";
import { Alert as UIAlert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AlertProps {
  title?: string;
  variant?: "default" | "destructive";
  /** Emoji or short glyph shown before the title */
  icon?: string;
  /** The message, edited inline */
  children: ReactNode;
}

function AlertImpl({ title, variant = "default", icon, children }: AlertProps) {
  return (
    // shadcn's icon column only kicks in for an <svg> child; an emoji span
    // needs the two columns spelled out.
    <UIAlert variant={variant} className={icon ? "grid-cols-[auto_1fr] gap-x-2" : undefined}>
      {icon ? (
        <span className="row-span-2 translate-y-0.5 text-base leading-none" aria-hidden>
          {icon}
        </span>
      ) : null}
      {title ? <AlertTitle className={icon ? "col-start-2" : undefined}>{title}</AlertTitle> : null}
      <AlertDescription className={icon ? "col-start-2" : undefined}>{children}</AlertDescription>
    </UIAlert>
  );
}

export const Alert = defineMDMX(AlertImpl, {
  name: "Alert",
  category: "UI",
  icon: "alert-triangle",
  description: "Callout with an optional title and icon",
  children: "rich-text",
  props: {
    title: { placeholder: "Heads up" },
    variant: { default: "default" },
    icon: { placeholder: "💡" },
  },
  preview: { title: "Heads up", children: "Something worth knowing." },
});

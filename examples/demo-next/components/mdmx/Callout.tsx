import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";
import { cn } from "@/lib/utils";

interface CalloutProps {
  /** Short label shown in the header */
  title?: string;
  variant: "info" | "warn" | "danger";
  children: ReactNode;
}

const ACCENT = {
  info: "border-l-primary",
  warn: "border-l-amber-500",
  danger: "border-l-destructive",
} as const;

function Callout({ title, variant, children }: CalloutProps) {
  return (
    <aside
      data-variant={variant}
      className={cn("rounded-lg border border-l-4 bg-card px-4 py-3.5 text-base", ACCENT[variant])}
    >
      {title ? <strong className="font-heading mb-1 block font-semibold">{title}</strong> : null}
      {children}
    </aside>
  );
}

export default defineMDMX(Callout, {
  name: "Callout",
  category: "Content",
  icon: "alert-circle",
  description: "Highlighted box for notes and warnings",
  children: "rich-text",
  props: {
    variant: { default: "info" },
    title: { placeholder: "Optional title" },
  },
  preview: { variant: "info", title: "Example", children: "Sample text" },
});

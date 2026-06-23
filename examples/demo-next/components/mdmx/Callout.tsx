import type { ReactNode } from "react";
import { defineIMDX } from "@imdx/core";

interface CalloutProps {
  /** Short label shown in the header */
  title?: string;
  variant: "info" | "warn" | "danger";
  children: ReactNode;
}

function Callout({ title, variant, children }: CalloutProps) {
  return (
    <aside data-variant={variant}>
      {title ? <strong>{title}</strong> : null}
      {children}
    </aside>
  );
}

export default defineIMDX(Callout, {
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

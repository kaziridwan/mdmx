import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";

interface CalloutProps {
  /** Short label shown in the header */
  title?: string;
  variant: "info" | "warn" | "danger";
  dismissible?: boolean;
  /** Excluded from the spec: functions are not serializable */
  onDismiss?: () => void;
  children: ReactNode;
}

function Callout({ title, children }: CalloutProps) {
  return (
    <div>
      {title}
      {children}
    </div>
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

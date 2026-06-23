import type { ReactNode } from "react";
import { defineIMDX } from "@imdx/core";

interface FeatureProps {
  title: string;
  /** Emoji or short glyph shown above the title */
  icon?: string;
  children: ReactNode;
}

function FeatureImpl({ title, icon, children }: FeatureProps) {
  return (
    <article className="mk-feature">
      {icon ? (
        <span className="mk-feature-icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      <h3 className="mk-feature-title">{title}</h3>
      <div className="mk-feature-body">{children}</div>
    </article>
  );
}

export const Feature = defineIMDX(FeatureImpl, {
  name: "Feature",
  category: "Marketing",
  icon: "check-circle",
  description: "A single feature card inside a FeatureGrid",
  children: "rich-text",
  constraints: { allowedParents: ["FeatureGrid"] },
  props: {
    title: { placeholder: "Feature title" },
    icon: { placeholder: "✨" },
  },
});

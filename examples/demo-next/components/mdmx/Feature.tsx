import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FeatureProps {
  title: string;
  /** Emoji or short glyph shown above the title */
  icon?: string;
  children: ReactNode;
}

function FeatureImpl({ title, icon, children }: FeatureProps) {
  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        {icon ? (
          <span className="text-2xl leading-none" aria-hidden>
            {icon}
          </span>
        ) : null}
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

export const Feature = defineMDMX(FeatureImpl, {
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

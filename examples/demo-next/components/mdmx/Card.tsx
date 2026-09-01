import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";
import { Card as UICard, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CardProps {
  title?: string;
  description?: string;
  size?: "default" | "sm";
  children: ReactNode;
}

function CardImpl({ title, description, size = "default", children }: CardProps) {
  return (
    <UICard size={size}>
      {title || description ? (
        <CardHeader>
          {title ? <CardTitle>{title}</CardTitle> : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
      ) : null}
      <CardContent>{children}</CardContent>
    </UICard>
  );
}

export const Card = defineMDMX(CardImpl, {
  name: "Card",
  category: "UI",
  icon: "square",
  description: "A bordered card with an optional header; holds any blocks",
  children: "blocks",
  props: {
    title: { placeholder: "Card title" },
    description: { placeholder: "Optional description" },
    size: { default: "default" },
  },
});

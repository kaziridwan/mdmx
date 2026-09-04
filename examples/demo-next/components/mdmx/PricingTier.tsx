import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PricingTierProps {
  name?: string;
  price?: string;
  period?: string;
  ctaLabel?: string;
  ctaHref?: string;
  featured?: boolean;
  /** Feature lines, edited inline */
  children: ReactNode;
}

function PricingTierImpl({ name = "Plan", price = "$0", period, ctaLabel, ctaHref, featured, children }: PricingTierProps) {
  return (
    <Card data-featured={featured ? "true" : undefined} className={cn("h-full", featured && "ring-2 ring-primary")}>
      <CardHeader>
        <CardDescription className="text-xs font-medium tracking-wider uppercase">{name}</CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums">
          {price}
          {period ? <span className="ml-0.5 text-base font-normal text-muted-foreground">/{period}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 text-sm text-muted-foreground">{children}</CardContent>
      {ctaLabel ? (
        <CardFooter>
          <a className={cn(buttonVariants({ variant: featured ? "default" : "outline" }), "w-full")} href={ctaHref ?? "#"}>
            {ctaLabel}
          </a>
        </CardFooter>
      ) : null}
    </Card>
  );
}

export const PricingTier = defineMDMX(PricingTierImpl, {
  name: "PricingTier",
  category: "Marketing",
  icon: "tag",
  description: "One plan inside a PricingTable",
  children: "rich-text",
  constraints: { allowedParents: ["PricingTable"] },
  props: {
    name: { placeholder: "Plan name", default: "Plan" },
    price: { placeholder: "$0", default: "$0" },
    period: { placeholder: "mo" },
    ctaLabel: { placeholder: "Choose plan" },
    ctaHref: { control: { type: "link" }, placeholder: "/signup", showIf: { prop: "ctaLabel" } },
    featured: { default: false },
  },
  preview: {
    name: "Starter",
    price: "$0",
    period: "mo",
    ctaLabel: "Choose plan",
    children: "Everything you need to get going.",
  },
});

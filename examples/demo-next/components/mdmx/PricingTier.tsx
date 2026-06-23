import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";

interface PricingTierProps {
  name: string;
  price: string;
  period?: string;
  ctaLabel?: string;
  ctaHref?: string;
  featured?: boolean;
  /** Feature lines, edited inline */
  children: ReactNode;
}

function PricingTierImpl({
  name,
  price,
  period,
  ctaLabel,
  ctaHref,
  featured,
  children,
}: PricingTierProps) {
  return (
    <article className="mk-tier" data-featured={featured ? "true" : undefined}>
      <h3 className="mk-tier-name">{name}</h3>
      <p className="mk-tier-price">
        <span className="mk-tier-amount">{price}</span>
        {period ? <span className="mk-tier-period">/{period}</span> : null}
      </p>
      <div className="mk-tier-features">{children}</div>
      {ctaLabel ? (
        <a className="mk-btn mk-btn-primary" href={ctaHref ?? "#"}>
          {ctaLabel}
        </a>
      ) : null}
    </article>
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
    name: { placeholder: "Plan name" },
    price: { placeholder: "$0" },
    period: { placeholder: "mo" },
    ctaLabel: { placeholder: "Choose plan" },
    ctaHref: { control: { type: "link" } },
    featured: { default: false },
  },
});

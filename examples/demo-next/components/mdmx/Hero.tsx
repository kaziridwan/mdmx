import { defineMDMX } from "@mdmx/core";

interface HeroProps {
  /** Small label above the title */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  align?: "left" | "center";
}

function HeroImpl({
  eyebrow,
  title,
  subtitle,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  align = "center",
}: HeroProps) {
  return (
    <section className="mk-hero" data-align={align}>
      {eyebrow ? <p className="mk-hero-eyebrow">{eyebrow}</p> : null}
      <h1 className="mk-hero-title">{title}</h1>
      {subtitle ? <p className="mk-hero-subtitle">{subtitle}</p> : null}
      {primaryLabel || secondaryLabel ? (
        <div className="mk-hero-actions">
          {primaryLabel ? (
            <a className="mk-btn mk-btn-primary" href={primaryHref ?? "#"}>
              {primaryLabel}
            </a>
          ) : null}
          {secondaryLabel ? (
            <a className="mk-btn mk-btn-ghost" href={secondaryHref ?? "#"}>
              {secondaryLabel}
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export const Hero = defineMDMX(HeroImpl, {
  name: "Hero",
  category: "Marketing",
  icon: "layout",
  description: "Headline section with title, subtitle, and call-to-action buttons",
  props: {
    eyebrow: { placeholder: "Eyebrow label" },
    title: { placeholder: "Headline" },
    subtitle: { control: { type: "textarea" }, placeholder: "Supporting subtitle" },
    primaryLabel: { placeholder: "Primary button" },
    primaryHref: { control: { type: "link" } },
    secondaryLabel: { placeholder: "Secondary button" },
    secondaryHref: { control: { type: "link" } },
    align: { default: "center" },
  },
  preview: {
    eyebrow: "Now in beta",
    title: "Ship content at the speed of git",
    subtitle: "Edit your components as blocks. Commit canonical MDMX.",
    primaryLabel: "Get started",
    secondaryLabel: "Read the docs",
  },
});

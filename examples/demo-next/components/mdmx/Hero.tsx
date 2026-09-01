import { defineMDMX } from "@mdmx/core";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const centered = align === "center";
  return (
    <section
      data-align={align}
      className={cn(
        "rounded-2xl border bg-linear-to-b from-primary/5 to-card px-8 py-14 @3xl:px-12 @3xl:py-22",
        centered ? "text-center" : "text-left",
      )}
    >
      {eyebrow ? (
        <p className="mb-2.5 text-xs font-semibold tracking-wider text-primary uppercase">{eyebrow}</p>
      ) : null}
      <h1 className="font-heading my-0 text-3xl font-semibold tracking-tight text-balance @3xl:text-5xl">
        {title}
      </h1>
      {subtitle ? (
        <p
          className={cn(
            "mt-3 mb-0 max-w-[46ch] text-lg text-muted-foreground @3xl:text-xl",
            centered && "mx-auto",
          )}
        >
          {subtitle}
        </p>
      ) : null}
      {primaryLabel || secondaryLabel ? (
        <div className={cn("mt-6 flex flex-wrap gap-3", centered ? "justify-center" : "justify-start")}>
          {primaryLabel ? (
            <a className={buttonVariants({ size: "lg" })} href={primaryHref ?? "#"}>
              {primaryLabel}
            </a>
          ) : null}
          {secondaryLabel ? (
            <a className={buttonVariants({ variant: "outline", size: "lg" })} href={secondaryHref ?? "#"}>
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

import { defineMDMX } from "@mdmx/core";

interface LogoCloudProps {
  title?: string;
  /** Comma-separated company names */
  names?: string;
}

function LogoCloudImpl({ title, names }: LogoCloudProps) {
  const items = (names ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <section className="py-3 text-center">
      {title ? (
        <p className="mt-0 mb-3.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">{title}</p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-x-7 gap-y-3">
        {items.map((name, i) => (
          <span className="font-heading text-lg font-semibold text-foreground/55" key={i}>
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}

export const LogoCloud = defineMDMX(LogoCloudImpl, {
  name: "LogoCloud",
  category: "Marketing",
  icon: "image",
  description: "A row of customer or partner logos (by name)",
  props: {
    title: { placeholder: "Trusted by teams at" },
    names: { control: { type: "textarea" }, placeholder: "Acme, Globex, Initech" },
  },
  preview: {
    title: "Trusted by teams at",
    names: "Acme, Globex, Initech, Umbrella, Hooli",
  },
});

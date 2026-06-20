import { defineIMDX } from "@imdx/core";

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
    <section className="mk-logos">
      {title ? <p className="mk-logos-title">{title}</p> : null}
      <div className="mk-logos-row">
        {items.map((name, i) => (
          <span className="mk-logo" key={i}>
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}

export const LogoCloud = defineIMDX(LogoCloudImpl, {
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

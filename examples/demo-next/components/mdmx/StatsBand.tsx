import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";

interface StatsBandProps {
  title?: string;
  children: ReactNode;
}

function StatsBandImpl({ title, children }: StatsBandProps) {
  return (
    <section className="mk-stats">
      {title ? <h2 className="mk-stats-title">{title}</h2> : null}
      <div className="mk-stats-row">{children}</div>
    </section>
  );
}

export const StatsBand = defineMDMX(StatsBandImpl, {
  name: "StatsBand",
  category: "Marketing",
  icon: "bar-chart-2",
  description: "A band of headline metrics (holds Stat blocks)",
  children: "blocks",
  constraints: { allowedChildren: ["Stat"] },
  props: {
    title: { placeholder: "Optional band title" },
  },
});

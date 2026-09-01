import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";

interface StatsBandProps {
  title?: string;
  children: ReactNode;
}

function StatsBandImpl({ title, children }: StatsBandProps) {
  return (
    <section className="rounded-2xl bg-muted px-6 py-7 text-center">
      {title ? (
        <h2 className="mt-0 mb-4 text-sm font-medium tracking-wider text-muted-foreground uppercase">
          {title}
        </h2>
      ) : null}
      <div className="grid grid-cols-1 justify-items-center gap-4 @md:grid-cols-3">{children}</div>
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

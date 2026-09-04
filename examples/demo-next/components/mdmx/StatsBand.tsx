import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";
import { cn } from "@/lib/utils";

interface StatsBandProps {
  title?: string;
  columns?: "2" | "3" | "4";
  children: ReactNode;
}

const COLUMNS = {
  "2": "@md:grid-cols-2",
  "3": "@md:grid-cols-3",
  "4": "@md:grid-cols-2 @3xl:grid-cols-4",
} as const;

function StatsBandImpl({ title, columns = "3", children }: StatsBandProps) {
  return (
    <section className="rounded-2xl bg-muted px-6 py-7 text-center">
      {title ? (
        <h2 className="mt-0 mb-4 text-sm font-medium tracking-wider text-muted-foreground uppercase">
          {title}
        </h2>
      ) : null}
      <div data-columns={columns} className={cn("grid grid-cols-1 justify-items-center gap-4", COLUMNS[columns] ?? COLUMNS["3"])}>
        {children}
      </div>
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
    columns: { control: { type: "select", options: ["2", "3", "4"] }, default: "3" },
  },
});

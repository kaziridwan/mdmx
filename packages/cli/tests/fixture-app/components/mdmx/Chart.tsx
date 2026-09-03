import { defineMDMX } from "@mdmx/core";

interface ChartProps {
  title?: string;
  height?: number;
  stacked?: boolean;
  series: string[];
  config?: { legend?: string; max?: number };
}

function ChartImpl({ series }: ChartProps) {
  return <svg data-series={series.join(",")} />;
}

export const Chart = defineMDMX(ChartImpl, {
  name: "Chart",
  category: "Data",
  icon: "bar-chart",
  render: { mode: "placeholder" },
  props: {
    // Panel-only visibility (registry v3): title only matters when stacked.
    title: { showIf: { prop: "stacked", eq: true } },
    // Invalid rules are warned about and dropped, never emitted.
    height: { showIf: { prop: "nope" } },
    config: { showIf: { prop: "config" } },
  },
  // Undeclared keys and children text on a children:none component are
  // warned about and dropped; the rest seeds the insert.
  preview: { title: "Sales", series: ["q1", "q2"], bogus: 1, children: "ignored" },
});

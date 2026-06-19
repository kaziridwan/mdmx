import { defineIMDX } from "@imdx/core";

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

export const Chart = defineIMDX(ChartImpl, {
  name: "Chart",
  category: "Data",
  icon: "bar-chart",
  render: { mode: "placeholder" },
});

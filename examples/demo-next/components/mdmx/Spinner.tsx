import { defineMDMX } from "@mdmx/core";
import { Spinner as UISpinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface SpinnerProps {
  label?: string;
  size?: "sm" | "default" | "lg";
}

const SIZES = { sm: "size-3", default: "size-4", lg: "size-6" } as const;

function SpinnerImpl({ label, size = "default" }: SpinnerProps) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <UISpinner className={cn(SIZES[size])} />
      {label ? <span>{label}</span> : null}
    </span>
  );
}

export const Spinner = defineMDMX(SpinnerImpl, {
  name: "Spinner",
  category: "UI",
  icon: "loader",
  description: "A loading indicator with an optional label",
  props: {
    label: { placeholder: "Loading…" },
    size: { default: "default" },
  },
  preview: { label: "Loading…" },
});

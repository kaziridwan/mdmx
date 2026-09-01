import { defineMDMX } from "@mdmx/core";
import { Skeleton as UISkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  shape?: "text" | "rect" | "circle";
  /** Number of lines when shape is "text" */
  lines?: number;
}

function SkeletonImpl({ shape = "text", lines = 3 }: SkeletonProps) {
  if (shape === "circle") return <UISkeleton className="size-12 rounded-full" />;
  if (shape === "rect") return <UISkeleton className="h-32 w-full rounded-xl" />;
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: Math.max(1, Math.min(8, lines)) }, (_, i) => (
        <UISkeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export const Skeleton = defineMDMX(SkeletonImpl, {
  name: "Skeleton",
  category: "UI",
  icon: "loader",
  description: "A loading placeholder",
  props: {
    shape: { default: "text" },
    lines: { control: { type: "number", min: 1, max: 8, step: 1 }, default: 3 },
  },
});

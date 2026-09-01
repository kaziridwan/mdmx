import { defineMDMX } from "@mdmx/core";
import { Progress as UIProgress, ProgressLabel, ProgressValue } from "@/components/ui/progress";

interface ProgressProps {
  /** 0–100 */
  value: number;
  label?: string;
  showValue?: boolean;
}

function ProgressImpl({ value, label, showValue = true }: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <UIProgress value={clamped}>
      {label ? <ProgressLabel>{label}</ProgressLabel> : null}
      {showValue ? <ProgressValue /> : null}
    </UIProgress>
  );
}

export const Progress = defineMDMX(ProgressImpl, {
  name: "Progress",
  category: "UI",
  icon: "loader",
  description: "A progress bar with an optional label",
  props: {
    value: { control: { type: "number", min: 0, max: 100, step: 1 }, default: 50 },
    label: { placeholder: "Uploading" },
    showValue: { default: true },
  },
  preview: { value: 62, label: "Progress" },
});

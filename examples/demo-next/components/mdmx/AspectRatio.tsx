import { defineMDMX } from "@mdmx/core";
import { AspectRatio as UIAspectRatio } from "@/components/ui/aspect-ratio";

interface AspectRatioProps {
  /** Image URL (pick from the media library) */
  src?: string;
  alt?: string;
  ratio?: "16/9" | "4/3" | "1/1" | "3/2" | "21/9";
}

const RATIOS = { "16/9": 16 / 9, "4/3": 4 / 3, "1/1": 1, "3/2": 3 / 2, "21/9": 21 / 9 } as const;

function AspectRatioImpl({ src = "/media/placeholder.svg", alt = "", ratio = "16/9" }: AspectRatioProps) {
  return (
    <UIAspectRatio ratio={RATIOS[ratio] ?? RATIOS["16/9"]} className="overflow-hidden rounded-xl bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="m-0 size-full rounded-none object-cover" />
    </UIAspectRatio>
  );
}

export const AspectRatio = defineMDMX(AspectRatioImpl, {
  name: "AspectRatio",
  category: "UI",
  icon: "crop",
  description: "An image cropped to a fixed aspect ratio",
  props: {
    src: { control: { type: "image" }, default: "/media/placeholder.svg" },
    alt: { placeholder: "Describe the image" },
    ratio: { control: { type: "select", options: ["16/9", "4/3", "1/1", "3/2", "21/9"] }, default: "16/9" },
  },
  preview: { src: "/media/placeholder.svg", alt: "Placeholder" },
});

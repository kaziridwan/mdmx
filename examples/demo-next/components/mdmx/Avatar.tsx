import { defineMDMX } from "@mdmx/core";
import { Avatar as UIAvatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AvatarProps {
  /** Image URL (pick from the media library) */
  src?: string;
  /** Initials shown while the image loads or when there is none */
  fallback?: string;
  alt?: string;
  size?: "sm" | "default" | "lg";
}

function AvatarImpl({ src, fallback = "JD", alt = "", size = "default" }: AvatarProps) {
  return (
    <UIAvatar size={size}>
      {src ? <AvatarImage src={src} alt={alt} /> : null}
      <AvatarFallback>{fallback}</AvatarFallback>
    </UIAvatar>
  );
}

export const Avatar = defineMDMX(AvatarImpl, {
  name: "Avatar",
  category: "UI",
  icon: "user",
  description: "A round profile image with initials fallback",
  props: {
    src: { control: { type: "image" } },
    fallback: { placeholder: "JD", default: "JD" },
    alt: { placeholder: "Who is pictured", showIf: { prop: "src" } },
    size: { control: { type: "select", options: ["sm", "default", "lg"] }, default: "default" },
  },
  preview: { fallback: "JD" },
});

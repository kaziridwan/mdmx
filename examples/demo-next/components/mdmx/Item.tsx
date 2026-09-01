import { defineMDMX } from "@mdmx/core";
import { Item as UIItem, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

interface ItemProps {
  title: string;
  description?: string;
  /** Emoji or short glyph shown on the left */
  icon?: string;
  variant?: "default" | "outline" | "muted";
}

function ItemImpl({ title, description, icon, variant = "outline" }: ItemProps) {
  return (
    <UIItem variant={variant}>
      {icon ? (
        <ItemMedia variant="icon" className="text-base">
          {icon}
        </ItemMedia>
      ) : null}
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        {description ? <ItemDescription className="m-0">{description}</ItemDescription> : null}
      </ItemContent>
    </UIItem>
  );
}

export const Item = defineMDMX(ItemImpl, {
  name: "Item",
  category: "UI",
  icon: "list",
  description: "A list row with a title, description, and icon",
  props: {
    title: { placeholder: "Item title" },
    description: { placeholder: "Optional description" },
    icon: { placeholder: "📦" },
    variant: { default: "outline" },
  },
  preview: { title: "An item", description: "With a short description." },
});

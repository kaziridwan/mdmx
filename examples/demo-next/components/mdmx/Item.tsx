import { defineMDMX } from "@mdmx/core";
import { Item as UIItem, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

interface ItemProps {
  title?: string;
  description?: string;
  /** Emoji or short glyph shown on the left */
  icon?: string;
  variant?: "default" | "outline" | "muted";
  size?: "default" | "sm" | "xs";
  /** Makes the row a link */
  href?: string;
}

function ItemImpl({ title = "Item", description, icon, variant = "outline", size = "default", href }: ItemProps) {
  const body = (
    <>
      {icon ? (
        <ItemMedia variant="icon" className="text-base">
          {icon}
        </ItemMedia>
      ) : null}
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        {description ? <ItemDescription className="m-0">{description}</ItemDescription> : null}
      </ItemContent>
    </>
  );
  if (href) {
    return (
      <UIItem variant={variant} size={size} render={<a href={href} />}>
        {body}
      </UIItem>
    );
  }
  return (
    <UIItem variant={variant} size={size}>
      {body}
    </UIItem>
  );
}

export const Item = defineMDMX(ItemImpl, {
  name: "Item",
  category: "UI",
  icon: "list",
  description: "A list row with a title, description, and icon",
  props: {
    title: { placeholder: "Item title", default: "Item" },
    description: { placeholder: "Optional description" },
    icon: { placeholder: "📦" },
    variant: { control: { type: "select", options: ["default", "outline", "muted"] }, default: "outline" },
    size: { control: { type: "select", options: ["default", "sm", "xs"] }, default: "default" },
    href: { control: { type: "link" }, placeholder: "/docs/item" },
  },
  preview: { title: "An item", description: "With a short description." },
});

import { defineMDMX } from "@mdmx/core";
import { Empty as UIEmpty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

interface EmptyProps {
  title?: string;
  description?: string;
  /** Emoji or short glyph */
  icon?: string;
}

function EmptyImpl({ title = "Nothing here yet", description, icon }: EmptyProps) {
  return (
    <UIEmpty className="border">
      <EmptyHeader>
        {icon ? (
          <EmptyMedia variant="icon" className="text-base">
            {icon}
          </EmptyMedia>
        ) : null}
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
    </UIEmpty>
  );
}

export const Empty = defineMDMX(EmptyImpl, {
  name: "Empty",
  category: "UI",
  icon: "inbox",
  description: "An empty-state placeholder with a title and description",
  props: {
    title: { placeholder: "Nothing here yet", default: "Nothing here yet" },
    description: { control: { type: "textarea" }, placeholder: "What to do about it" },
    icon: { placeholder: "📭" },
  },
  preview: { title: "Nothing here yet", description: "Add something to get started." },
});

import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";
import { HoverCard as UIHoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface HoverCardProps {
  /** Card heading */
  title?: string;
  /** Card body, shown on hover */
  content: string;
  /** The text that reveals the card, edited inline */
  children: ReactNode;
}

// The trigger renders as a span so the inline-editable children stay plain
// text; the card body is a prop because a popup unmounts when closed and an
// editable region must stay in the DOM.
function HoverCardImpl({ title, content, children }: HoverCardProps) {
  return (
    <UIHoverCard>
      <HoverCardTrigger render={<span className="cursor-help underline decoration-dotted underline-offset-4" />}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent>
        {title ? <div className="mb-1 font-medium">{title}</div> : null}
        <p className="m-0 text-muted-foreground">{content}</p>
      </HoverCardContent>
    </UIHoverCard>
  );
}

export const HoverCard = defineMDMX(HoverCardImpl, {
  name: "HoverCard",
  category: "UI",
  icon: "message-circle",
  description: "Text that reveals a card on hover",
  children: "rich-text",
  props: {
    title: { placeholder: "Card title" },
    content: { control: { type: "textarea" }, placeholder: "Card body" },
  },
  preview: { title: "MDMX", content: "A git-native CMS for Next.js.", children: "Hover over me" },
});

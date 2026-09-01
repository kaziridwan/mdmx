import { defineMDMX } from "@mdmx/core";
import { Kbd as UIKbd, KbdGroup } from "@/components/ui/kbd";

interface KbdProps {
  /** Keys separated by spaces, e.g. "⌘ K" */
  keys: string;
}

function KbdImpl({ keys }: KbdProps) {
  const parts = keys.split(/\s+/).filter(Boolean);
  return (
    <KbdGroup>
      {parts.map((key, i) => (
        <UIKbd key={i}>{key}</UIKbd>
      ))}
    </KbdGroup>
  );
}

export const Kbd = defineMDMX(KbdImpl, {
  name: "Kbd",
  category: "UI",
  icon: "keyboard",
  description: "A keyboard shortcut",
  props: {
    keys: { placeholder: "⌘ K" },
  },
  preview: { keys: "⌘ K" },
});

import { defineMDMX } from "@mdmx/core";
import { Kbd as UIKbd, KbdGroup } from "@/components/ui/kbd";

interface KbdProps {
  /** One key per entry, e.g. ⌘ and K */
  keys?: string[];
}

function KbdImpl({ keys = ["⌘", "K"] }: KbdProps) {
  const parts = (Array.isArray(keys) ? keys : []).map((key) => String(key).trim()).filter(Boolean);
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
    keys: { default: ["⌘", "K"] },
  },
  preview: { keys: ["⌘", "K"] },
});

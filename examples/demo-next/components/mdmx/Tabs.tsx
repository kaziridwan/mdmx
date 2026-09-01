"use client";
import { useId, useState, type ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";
import { Tabs as UITabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TabsProps {
  /** Tab titles, comma-separated — each matches a Tab block's title */
  tabs: string;
  variant?: "default" | "line";
  children: ReactNode;
}

// The tab list is this block's; the panels are Tab child blocks. Children are
// separate React trees in the editor, so the active tab is broadcast through
// CSS rather than context: a scoped rule hides every panel but the active one.
function TabsImpl({ tabs, variant = "default", children }: TabsProps) {
  const id = useId();
  const titles = tabs.split(",").map((t) => t.trim()).filter(Boolean);
  const [active, setActive] = useState(titles[0] ?? "");
  const current = titles.includes(active) ? active : (titles[0] ?? "");
  const scope = `mdmx-tabs-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <div data-tabs={scope} className="flex flex-col gap-3">
      <style>{`[data-tabs="${scope}"] [data-tab-panel]:not([data-tab-panel=${JSON.stringify(current)}]) { display: none; }`}</style>
      <UITabs value={current} onValueChange={(value) => setActive(String(value))}>
        <TabsList variant={variant}>
          {titles.map((title) => (
            <TabsTrigger key={title} value={title}>
              {title}
            </TabsTrigger>
          ))}
        </TabsList>
      </UITabs>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const Tabs = defineMDMX(TabsImpl, {
  name: "Tabs",
  category: "UI",
  icon: "panel-top",
  description: "Tabbed panels (holds Tab blocks whose titles match)",
  children: "blocks",
  constraints: { allowedChildren: ["Tab"] },
  props: {
    tabs: { placeholder: "Overview, Details" },
    variant: { default: "default" },
  },
});

"use client";
import { useId, useState, type ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";
import { Tabs as UITabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface TabsProps {
  /** Tab titles — each matches a Tab block's title */
  tabs?: string[];
  variant?: "default" | "line";
  orientation?: "horizontal" | "vertical";
  /** Title of the tab shown first (defaults to the first) */
  defaultTab?: string;
  children: ReactNode;
}

// The tab list is this block's; the panels are Tab child blocks. Children are
// separate React trees in the editor, so the active tab is broadcast through
// CSS rather than context: a scoped rule hides every panel but the active one.
function TabsImpl({
  tabs = ["Overview", "Details"],
  variant = "default",
  orientation = "horizontal",
  defaultTab,
  children,
}: TabsProps) {
  const id = useId();
  const titles = (Array.isArray(tabs) ? tabs : []).map((t) => String(t).trim()).filter(Boolean);
  const initial = defaultTab && titles.includes(defaultTab) ? defaultTab : (titles[0] ?? "");
  const [active, setActive] = useState(initial);
  const current = titles.includes(active) ? active : initial;
  const scope = `mdmx-tabs-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const vertical = orientation === "vertical";
  return (
    <div data-tabs={scope} className={cn(vertical ? "flex items-start gap-4" : "flex flex-col gap-3")}>
      <style>{`[data-tabs="${scope}"] [data-tab-panel]:not([data-tab-panel=${JSON.stringify(current)}]) { display: none; }`}</style>
      <UITabs value={current} orientation={orientation} onValueChange={(value) => setActive(String(value))}>
        <TabsList variant={variant}>
          {titles.map((title) => (
            <TabsTrigger key={title} value={title}>
              {title}
            </TabsTrigger>
          ))}
        </TabsList>
      </UITabs>
      <div className="min-w-0 flex-1">{children}</div>
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
    tabs: { default: ["Overview", "Details"] },
    variant: { control: { type: "select", options: ["default", "line"] }, default: "default" },
    orientation: { control: { type: "select", options: ["horizontal", "vertical"] }, default: "horizontal" },
    defaultTab: { placeholder: "Overview" },
  },
  preview: { tabs: ["Overview", "Details"] },
});

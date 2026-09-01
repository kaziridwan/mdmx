import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";

interface TabProps {
  /** Must match one of the parent Tabs' titles */
  title: string;
  children: ReactNode;
}

function TabImpl({ title, children }: TabProps) {
  return (
    <div data-tab-panel={title} className="text-sm">
      {children}
    </div>
  );
}

export const Tab = defineMDMX(TabImpl, {
  name: "Tab",
  category: "UI",
  icon: "panel-top",
  description: "One panel inside Tabs",
  children: "blocks",
  constraints: { allowedParents: ["Tabs"] },
  props: {
    title: { placeholder: "Overview" },
  },
});

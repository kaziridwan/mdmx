import { defineMDMX } from "@mdmx/core";

interface HiddenProps {
  label?: string;
}

function HiddenImpl({ label }: HiddenProps) {
  return <span>{label}</span>;
}

// Deliberately NOT exported: generate must warn and exclude it (a fabricated
// import would make registry.ts fail to compile).
const Hidden = defineMDMX(HiddenImpl, {
  name: "Hidden",
  category: "Content",
});

void Hidden;

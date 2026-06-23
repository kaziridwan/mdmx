import { createRoot } from "react-dom/client";
import { Registry, type RegistrySpec } from "@mdmx/core";
import { MDMXEditor, type ComponentMap } from "@mdmx/editor/react";
import "./styles.css";

// Demo project assets. Run `mdmx generate` in examples/demo first to produce
// the registry. Components render live; the .mdx is the initial document.
import registryJson from "../../demo/.mdmx/registry.json";
import welcomeSource from "../../demo/content/posts/welcome.mdx?raw";
import Callout from "../../demo/components/mdmx/Callout";
import { Stat } from "../../demo/components/mdmx/Stat";

const registry = new Registry(registryJson as RegistrySpec);
const components: ComponentMap = { Callout, Stat };

createRoot(document.getElementById("root")!).render(
  <MDMXEditor registry={registry} components={components} source={welcomeSource} />,
);

import { createRoot } from "react-dom/client";
import { Registry, type RegistrySpec } from "@imdx/core";
import { IMDXEditor, type ComponentMap } from "@imdx/editor/react";
import "./styles.css";

// Demo project assets. Run `imdx generate` in examples/demo first to produce
// the registry. Components render live; the .mdx is the initial document.
import registryJson from "../../demo/.imdx/registry.json";
import welcomeSource from "../../demo/content/posts/welcome.mdx?raw";
import Callout from "../../demo/components/imdx/Callout";
import { Stat } from "../../demo/components/imdx/Stat";

const registry = new Registry(registryJson as RegistrySpec);
const components: ComponentMap = { Callout, Stat };

createRoot(document.getElementById("root")!).render(
  <IMDXEditor registry={registry} components={components} source={welcomeSource} />,
);

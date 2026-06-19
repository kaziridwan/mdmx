import { Registry, type RegistrySpec } from "../src/index.js";

export const testRegistrySpec: RegistrySpec = {
  imdxRegistryVersion: 1,
  components: [
    {
      name: "Callout",
      category: "Content",
      children: { policy: "rich-text" },
      props: [
        {
          name: "variant",
          required: true,
          control: { type: "select", options: ["info", "warn", "danger"] },
          default: "info",
        },
        { name: "title", required: false, control: { type: "text" } },
        {
          name: "dismissible",
          required: false,
          control: { type: "boolean" },
          default: false,
        },
      ],
    },
    {
      name: "Chart",
      category: "Data",
      children: { policy: "none" },
      props: [
        { name: "title", required: false, control: { type: "text" } },
        { name: "height", required: false, control: { type: "number" } },
        { name: "stacked", required: false, control: { type: "boolean" } },
        {
          name: "series",
          required: true,
          control: { type: "list", item: { type: "text" } },
        },
        { name: "config", required: false, control: { type: "json" } },
      ],
    },
    {
      name: "TwoColumn",
      category: "Layout",
      children: { policy: "blocks" },
      constraints: { allowedParents: null, allowedChildren: ["Column"] },
      props: [],
    },
    {
      name: "Column",
      category: "Layout",
      children: { policy: "blocks" },
      constraints: { allowedParents: ["TwoColumn"], allowedChildren: null },
      props: [],
    },
  ],
};

export const testRegistry = new Registry(testRegistrySpec);

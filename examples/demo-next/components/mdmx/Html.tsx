import { defineMDMX } from "@mdmx/core";
import { sanitizeHtml } from "@mdmx/editor";

interface HtmlProps {
  /** Raw HTML, sanitized before render */
  code: string;
}

function HtmlImpl({ code }: HtmlProps) {
  return (
    <div className="mk-html" dangerouslySetInnerHTML={{ __html: sanitizeHtml(code ?? "") }} />
  );
}

export const Html = defineMDMX(HtmlImpl, {
  name: "Html",
  category: "Advanced",
  icon: "code",
  description: "Custom HTML block (sanitized on render)",
  props: {
    code: { control: { type: "textarea" }, placeholder: "<div>…</div>" },
  },
  preview: {
    code: '<div style="padding:12px;border-radius:10px;background:#eef2ff">Custom <strong>HTML</strong> block</div>',
  },
});

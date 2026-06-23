import type { ReactNode } from "react";
import { defineIMDX } from "@imdx/core";

interface TestimonialProps {
  author: string;
  role?: string;
  avatar?: string;
  /** The quote, edited inline */
  children: ReactNode;
}

function TestimonialImpl({ author, role, avatar, children }: TestimonialProps) {
  return (
    <figure className="mk-quote">
      <blockquote className="mk-quote-body">{children}</blockquote>
      <figcaption className="mk-quote-cite">
        {avatar ? <img className="mk-quote-avatar" src={avatar} alt="" /> : null}
        <span>
          <span className="mk-quote-author">{author}</span>
          {role ? <span className="mk-quote-role">{role}</span> : null}
        </span>
      </figcaption>
    </figure>
  );
}

export const Testimonial = defineIMDX(TestimonialImpl, {
  name: "Testimonial",
  category: "Marketing",
  icon: "message-square",
  description: "A customer quote with attribution",
  children: "rich-text",
  props: {
    author: { placeholder: "Jane Doe" },
    role: { placeholder: "CTO, Acme" },
    avatar: { control: { type: "image" } },
  },
  preview: {
    author: "Jane Doe",
    role: "CTO, Acme",
    children: "iMDX let our writers ship landing pages without touching the build.",
  },
});

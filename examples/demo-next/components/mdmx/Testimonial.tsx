import type { ReactNode } from "react";
import { defineMDMX } from "@mdmx/core";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TestimonialProps {
  author?: string;
  role?: string;
  avatar?: string;
  /** The quote, edited inline */
  children: ReactNode;
}

const initials = (name: string) =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

function TestimonialImpl({ author = "Jane Doe", role, avatar, children }: TestimonialProps) {
  return (
    <figure className="my-0 border-l-2 border-primary py-2 pl-6">
      <blockquote className="font-serif my-0 mb-3.5 border-0 p-0 text-xl text-foreground">{children}</blockquote>
      <figcaption className="flex items-center gap-3">
        <Avatar size="lg">
          {avatar ? <AvatarImage src={avatar} alt="" /> : null}
          <AvatarFallback>{initials(author)}</AvatarFallback>
        </Avatar>
        <span className="flex flex-col">
          <span className="font-semibold">{author}</span>
          {role ? <span className="text-sm text-muted-foreground">{role}</span> : null}
        </span>
      </figcaption>
    </figure>
  );
}

export const Testimonial = defineMDMX(TestimonialImpl, {
  name: "Testimonial",
  category: "Marketing",
  icon: "message-square",
  description: "A customer quote with attribution",
  children: "rich-text",
  props: {
    author: { placeholder: "Jane Doe", default: "Jane Doe" },
    role: { placeholder: "CTO, Acme" },
    avatar: { control: { type: "image" } },
  },
  preview: {
    author: "Jane Doe",
    role: "CTO, Acme",
    children: "MDMX let our writers ship landing pages without touching the build.",
  },
});

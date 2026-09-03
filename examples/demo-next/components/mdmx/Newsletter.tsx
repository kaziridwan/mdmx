"use client";
// The submit handler makes this a client component; server-rendered pages
// pass it serializable props across the RSC boundary.
import { defineMDMX } from "@mdmx/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NewsletterProps {
  heading?: string;
  buttonLabel?: string;
  placeholder?: string;
  note?: string;
}

function NewsletterImpl({ heading = "Stay in the loop", buttonLabel = "Subscribe", placeholder, note }: NewsletterProps) {
  return (
    <section className="rounded-2xl border bg-card px-6 py-8 text-center">
      <h2 className="font-heading mt-0 mb-4 text-2xl font-semibold">{heading}</h2>
      <form className="flex flex-wrap justify-center gap-2.5" onSubmit={(e) => e.preventDefault()}>
        <Input
          type="email"
          className="h-9 w-64 max-w-full"
          placeholder={placeholder ?? "you@example.com"}
          aria-label="Email address"
        />
        <Button type="submit" size="lg">
          {buttonLabel}
        </Button>
      </form>
      {note ? <p className="mt-3 mb-0 text-sm text-muted-foreground">{note}</p> : null}
    </section>
  );
}

export const Newsletter = defineMDMX(NewsletterImpl, {
  name: "Newsletter",
  category: "Marketing",
  icon: "mail",
  description: "Email signup band",
  props: {
    heading: { placeholder: "Stay in the loop", default: "Stay in the loop" },
    buttonLabel: { placeholder: "Subscribe", default: "Subscribe" },
    placeholder: { placeholder: "you@example.com" },
    note: { control: { type: "textarea" }, placeholder: "No spam. Unsubscribe anytime." },
  },
  preview: {
    heading: "Stay in the loop",
    buttonLabel: "Subscribe",
    note: "Product updates, roughly monthly.",
  },
});

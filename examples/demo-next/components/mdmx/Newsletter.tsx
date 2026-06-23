import { defineMDMX } from "@mdmx/core";

interface NewsletterProps {
  heading: string;
  buttonLabel: string;
  placeholder?: string;
  note?: string;
}

function NewsletterImpl({ heading, buttonLabel, placeholder, note }: NewsletterProps) {
  return (
    <section className="mk-newsletter">
      <h2 className="mk-newsletter-heading">{heading}</h2>
      <form className="mk-newsletter-form" onSubmit={(e) => e.preventDefault()}>
        <input
          className="mk-newsletter-input"
          type="email"
          placeholder={placeholder ?? "you@example.com"}
        />
        <button className="mk-btn mk-btn-primary" type="submit">
          {buttonLabel}
        </button>
      </form>
      {note ? <p className="mk-newsletter-note">{note}</p> : null}
    </section>
  );
}

export const Newsletter = defineMDMX(NewsletterImpl, {
  name: "Newsletter",
  category: "Marketing",
  icon: "mail",
  description: "Email signup band",
  props: {
    heading: { placeholder: "Stay in the loop" },
    buttonLabel: { placeholder: "Subscribe" },
    placeholder: { placeholder: "you@example.com" },
    note: { control: { type: "textarea" }, placeholder: "No spam. Unsubscribe anytime." },
  },
  preview: {
    heading: "Stay in the loop",
    buttonLabel: "Subscribe",
    note: "Product updates, roughly monthly.",
  },
});

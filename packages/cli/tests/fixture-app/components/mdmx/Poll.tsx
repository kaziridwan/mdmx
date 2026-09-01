import { defineMDMX } from "@mdmx/core";

interface PollProps {
  question: string;
  options: string[];
}

function PollImpl({ question, options }: PollProps) {
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <p>{question}</p>
      {options.map((option) => (
        <button key={option} type="button">
          {option}
        </button>
      ))}
    </form>
  );
}

// `interactive: true` — every event inside the block reaches the component.
export const Poll = defineMDMX(PollImpl, {
  name: "Poll",
  category: "Interactive",
  render: { interactive: true },
});

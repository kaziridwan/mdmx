import { defineMDMX } from "@mdmx/core";
import {
  Table as UITable,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TableProps {
  /** Column headings, comma-separated */
  columns: string;
  /** One row per line; cells separated by "|" */
  rows: string;
  caption?: string;
}

const splitCells = (line: string) => line.split("|").map((cell) => cell.trim());

function TableImpl({ columns, rows, caption }: TableProps) {
  const heads = columns.split(",").map((c) => c.trim()).filter(Boolean);
  const body = rows
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitCells);
  return (
    <UITable>
      {caption ? <TableCaption>{caption}</TableCaption> : null}
      <TableHeader>
        <TableRow>
          {heads.map((head, i) => (
            <TableHead key={i}>{head}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {body.map((cells, r) => (
          <TableRow key={r}>
            {heads.map((_, c) => (
              <TableCell key={c}>{cells[c] ?? ""}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </UITable>
  );
}

export const Table = defineMDMX(TableImpl, {
  name: "Table",
  category: "UI",
  icon: "table",
  description: "A simple data table (headings + rows as text)",
  props: {
    columns: { placeholder: "Plan, Price, Seats" },
    rows: { control: { type: "textarea" }, placeholder: "Starter | $0 | 1\nTeam | $29 | 10" },
    caption: { placeholder: "Optional caption" },
  },
  preview: {
    columns: "Plan, Price, Seats",
    rows: "Starter | $0 | 1\nTeam | $29 | 10\nEnterprise | Custom | Unlimited",
  },
});

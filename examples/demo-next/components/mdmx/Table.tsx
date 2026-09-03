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
  /** Column headings */
  columns?: string[];
  /** Rows of cells, in column order */
  rows?: string[][];
  caption?: string;
}

const cellText = (cell: unknown) => (cell == null ? "" : String(cell));

function TableImpl({ columns = ["Plan", "Price"], rows = [["Starter", "$0"]], caption }: TableProps) {
  const heads = (Array.isArray(columns) ? columns : []).map(cellText);
  const body = (Array.isArray(rows) ? rows : []).map((row) => (Array.isArray(row) ? row.map(cellText) : [cellText(row)]));
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
  description: "A simple data table (headings + rows)",
  props: {
    columns: { default: ["Plan", "Price"] },
    rows: { default: [["Starter", "$0"]] },
    caption: { placeholder: "Optional caption" },
  },
  preview: {
    columns: ["Plan", "Price", "Seats"],
    rows: [
      ["Starter", "$0", "1"],
      ["Team", "$29", "10"],
      ["Enterprise", "Custom", "Unlimited"],
    ],
  },
});

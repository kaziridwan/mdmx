import ts from "typescript";
import type { ControlSpec } from "@imdx/core";

/** Infer an editor control from a TypeScript type. */
export function inferControl(type: ts.Type, checker: ts.TypeChecker): ControlSpec {
  // Strip null/undefined from optionals.
  const stripped = stripNullish(type, checker);

  if (stripped.length > 1) {
    // All string literals → select.
    if (stripped.every((t) => t.isStringLiteral())) {
      return {
        type: "select",
        options: stripped.map((t) => (t as ts.StringLiteralType).value),
      };
    }
    // boolean expands to true | false literals.
    if (stripped.every((t) => isBooleanish(t))) return { type: "boolean" };
    // Heterogeneous union → raw JSON editing.
    return { type: "json" };
  }

  const t = stripped[0] ?? type;

  if (t.isStringLiteral()) return { type: "select", options: [t.value] };
  if (isBooleanish(t)) return { type: "boolean" };
  if (t.flags & ts.TypeFlags.String) return { type: "text" };
  if (t.flags & (ts.TypeFlags.Number | ts.TypeFlags.NumberLiteral)) {
    return { type: "number" };
  }

  if (checker.isArrayType(t) || checker.isTupleType(t)) {
    const args = checker.getTypeArguments(t as ts.TypeReference);
    const item = args[0] ? inferControl(args[0], checker) : { type: "json" as const };
    return { type: "list", item };
  }

  return { type: "json" };
}

function stripNullish(type: ts.Type, checker: ts.TypeChecker): ts.Type[] {
  const members = type.isUnion() ? type.types : [type];
  return members.filter(
    (t) => !(t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void)),
  );
}

function isBooleanish(t: ts.Type): boolean {
  return Boolean(t.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral));
}

/** Does this type look like a function (and thus can't be serialized)? */
export function isFunctionType(type: ts.Type): boolean {
  const members = type.isUnion() ? type.types : [type];
  return members.some((t) => t.getCallSignatures().length > 0);
}

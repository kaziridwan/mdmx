import ts from "typescript";
import type { JsonValue } from "@imdx/core";

/**
 * Statically evaluate a TS expression to a JSON value. The defineIMDX config
 * must be a literal object — identifiers, calls, and computed values are
 * rejected so the CLI never needs to execute user code.
 */
export function staticEval(
  node: ts.Expression,
): { ok: true; value: JsonValue } | { ok: false; reason: string; node: ts.Node } {
  if (ts.isStringLiteralLike(node)) return { ok: true, value: node.text };
  if (ts.isNumericLiteral(node)) return { ok: true, value: Number(node.text) };
  if (node.kind === ts.SyntaxKind.TrueKeyword) return { ok: true, value: true };
  if (node.kind === ts.SyntaxKind.FalseKeyword) return { ok: true, value: false };
  if (node.kind === ts.SyntaxKind.NullKeyword) return { ok: true, value: null };

  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return { ok: true, value: -Number(node.operand.text) };
  }

  if (ts.isParenthesizedExpression(node)) return staticEval(node.expression);

  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return staticEval(node.expression);
  }

  if (ts.isArrayLiteralExpression(node)) {
    const out: JsonValue[] = [];
    for (const el of node.elements) {
      if (ts.isSpreadElement(el)) {
        return { ok: false, reason: "spread elements are not allowed", node: el };
      }
      const inner = staticEval(el);
      if (!inner.ok) return inner;
      out.push(inner.value);
    }
    return { ok: true, value: out };
  }

  if (ts.isObjectLiteralExpression(node)) {
    const out: Record<string, JsonValue> = {};
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) {
        return {
          ok: false,
          reason: "only plain `key: value` properties are allowed",
          node: prop,
        };
      }
      let key: string;
      if (ts.isIdentifier(prop.name) || ts.isStringLiteralLike(prop.name)) {
        key = prop.name.text;
      } else {
        return { ok: false, reason: "computed keys are not allowed", node: prop.name };
      }
      const inner = staticEval(prop.initializer);
      if (!inner.ok) return inner;
      out[key] = inner.value;
    }
    return { ok: true, value: out };
  }

  return {
    ok: false,
    reason: `expression kind "${ts.SyntaxKind[node.kind]}" cannot be statically evaluated`,
    node,
  };
}

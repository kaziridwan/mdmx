import type {
  MdxJsxAttribute,
  MdxJsxFlowElement,
  MdxJsxTextElement,
} from "mdast-util-mdx-jsx";
import type {
  Expression,
  ObjectExpression,
  Program,
} from "estree";
import type { Diagnostic, JsonValue, PropsObject, SourceSpan } from "./types.js";

export interface EvaluatedProps {
  props: PropsObject;
  diagnostics: Diagnostic[];
}

function spanOf(node: { position?: { start: any; end: any } }): SourceSpan | undefined {
  const p = node.position;
  if (!p) return undefined;
  return {
    start: { line: p.start.line, column: p.start.column },
    end: { line: p.end.line, column: p.end.column },
  };
}

/**
 * Evaluate an estree expression to a JSON value, permitting only the
 * "props are JSON" grammar: string/number/boolean/null literals, arrays,
 * plain objects with static keys, and unary minus on numbers.
 *
 * Returns { ok: false } for anything else (identifiers, calls, templates,
 * spreads, computed keys, regex, …).
 */
export function evaluateExpression(
  expr: Expression,
): { ok: true; value: JsonValue } | { ok: false; reason: string } {
  switch (expr.type) {
    case "Literal": {
      const v = expr.value;
      if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean" ||
        v === null
      ) {
        return { ok: true, value: v };
      }
      return {
        ok: false,
        reason: `unsupported literal (${"regex" in expr ? "regex" : typeof v})`,
      };
    }
    case "UnaryExpression": {
      if (expr.operator === "-" && expr.argument.type === "Literal") {
        const inner = evaluateExpression(expr.argument);
        if (inner.ok && typeof inner.value === "number") {
          return { ok: true, value: -inner.value };
        }
      }
      return { ok: false, reason: "unsupported unary expression" };
    }
    case "ArrayExpression": {
      const out: JsonValue[] = [];
      for (const el of expr.elements) {
        if (el === null) return { ok: false, reason: "array holes are not allowed" };
        if (el.type === "SpreadElement") {
          return { ok: false, reason: "spread elements are not allowed" };
        }
        const inner = evaluateExpression(el);
        if (!inner.ok) return inner;
        out.push(inner.value);
      }
      return { ok: true, value: out };
    }
    case "ObjectExpression":
      return evaluateObject(expr);
    default:
      return { ok: false, reason: `expression type "${expr.type}" is not allowed` };
  }
}

function evaluateObject(
  expr: ObjectExpression,
): { ok: true; value: JsonValue } | { ok: false; reason: string } {
  const out: Record<string, JsonValue> = {};
  for (const prop of expr.properties) {
    if (prop.type !== "Property") {
      return { ok: false, reason: "object spread is not allowed" };
    }
    if (prop.computed || prop.kind !== "init") {
      return { ok: false, reason: "computed keys / getters are not allowed" };
    }
    let key: string;
    if (prop.key.type === "Identifier") key = prop.key.name;
    else if (prop.key.type === "Literal" && typeof prop.key.value === "string") {
      key = prop.key.value;
    } else {
      return { ok: false, reason: "object keys must be identifiers or string literals" };
    }
    const valueType: string = prop.value.type;
    if (
      valueType === "AssignmentPattern" ||
      valueType === "ObjectPattern" ||
      valueType === "ArrayPattern" ||
      valueType === "RestElement"
    ) {
      return { ok: false, reason: "pattern values are not allowed" };
    }
    const inner = evaluateExpression(prop.value as Expression);
    if (!inner.ok) return inner;
    out[key] = inner.value;
  }
  return { ok: true, value: out };
}

function programExpression(program: Program | undefined): Expression | undefined {
  if (!program) return undefined;
  const stmt = program.body[0];
  if (stmt && stmt.type === "ExpressionStatement") return stmt.expression;
  return undefined;
}

/**
 * Evaluate the attributes of a JSX element into a props object.
 * Emits MDMX002 diagnostics for anything outside the JSON grammar
 * (including spread attributes).
 */
export function evaluateAttributes(
  element: MdxJsxFlowElement | MdxJsxTextElement,
): EvaluatedProps {
  const props: PropsObject = {};
  const diagnostics: Diagnostic[] = [];
  const componentName = element.name ?? "<fragment>";

  for (const attr of element.attributes) {
    if (attr.type === "mdxJsxExpressionAttribute") {
      diagnostics.push({
        code: "MDMX002",
        severity: "error",
        message: `Spread attributes are not allowed on <${componentName}>.`,
        span: spanOf(attr as never) ?? spanOf(element),
      });
      continue;
    }
    const a = attr as MdxJsxAttribute;
    if (a.value == null) {
      // Boolean shorthand: <Chart stacked />
      props[a.name] = true;
      continue;
    }
    if (typeof a.value === "string") {
      props[a.name] = a.value;
      continue;
    }
    // mdxJsxAttributeValueExpression
    const estree = (a.value.data as { estree?: Program } | undefined)?.estree;
    const expr = programExpression(estree);
    if (!expr) {
      diagnostics.push({
        code: "MDMX002",
        severity: "error",
        message: `Prop "${a.name}" on <${componentName}> has an empty or unparsable expression.`,
        span: spanOf(a as never) ?? spanOf(element),
      });
      continue;
    }
    const result = evaluateExpression(expr);
    if (!result.ok) {
      diagnostics.push({
        code: "MDMX002",
        severity: "error",
        message: `Prop "${a.name}" on <${componentName}> is not statically serializable: ${result.reason}. Props must be JSON values.`,
        span: spanOf(a as never) ?? spanOf(element),
      });
      continue;
    }
    props[a.name] = result.value;
  }

  return { props, diagnostics };
}

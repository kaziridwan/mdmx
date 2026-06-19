import ts from "typescript";
import { relative } from "node:path";
import type {
  ComponentSpec,
  DefineIMDXConfig,
  JsonValue,
  PropSpec,
} from "@imdx/core";
import { inferControl, isFunctionType } from "./infer.js";
import { staticEval } from "./static-eval.js";

export interface ExtractionIssue {
  severity: "error" | "warning";
  message: string;
  file: string;
  line?: number;
}

export interface ExtractedComponent {
  spec: ComponentSpec;
  /** Absolute path of the file containing the defineIMDX call. */
  file: string;
  /** How the tagged component is exported: "default" or a named export. */
  exportName: string;
}

export interface ExtractionResult {
  components: ExtractedComponent[];
  issues: ExtractionIssue[];
}

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  skipLibCheck: true,
  noEmit: true,
};

export function extractComponents(files: string[], cwd: string): ExtractionResult {
  const program = ts.createProgram(files, COMPILER_OPTIONS);
  const checker = program.getTypeChecker();
  const issues: ExtractionIssue[] = [];
  const components: ExtractedComponent[] = [];
  const wanted = new Set(files.map((f) => ts.sys.resolvePath(f)));

  for (const sf of program.getSourceFiles()) {
    if (!wanted.has(ts.sys.resolvePath(sf.fileName))) continue;
    visit(sf);

    function visit(node: ts.Node): void {
      if (isDefineIMDXCall(node)) {
        handleCall(node, sf);
      }
      ts.forEachChild(node, visit);
    }
  }

  return { components, issues };

  function lineOf(node: ts.Node, sf: ts.SourceFile): number {
    return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  }

  function handleCall(call: ts.CallExpression, sf: ts.SourceFile): void {
    const rel = relative(cwd, sf.fileName);
    const fail = (message: string, node: ts.Node = call): void => {
      issues.push({ severity: "error", message, file: rel, line: lineOf(node, sf) });
    };
    const warn = (message: string, node: ts.Node = call): void => {
      issues.push({ severity: "warning", message, file: rel, line: lineOf(node, sf) });
    };

    const [componentArg, configArg] = call.arguments;
    if (!componentArg || !configArg) {
      fail("defineIMDX(component, config) requires both arguments.");
      return;
    }
    if (!ts.isObjectLiteralExpression(configArg)) {
      fail("defineIMDX config must be an inline object literal.", configArg);
      return;
    }

    const evaluated = staticEval(configArg);
    if (!evaluated.ok) {
      fail(`defineIMDX config is not statically evaluable: ${evaluated.reason}.`, evaluated.node as ts.Node);
      return;
    }
    const config = evaluated.value as unknown as DefineIMDXConfig;
    if (!config.name || typeof config.name !== "string") {
      fail('defineIMDX config must declare a string "name".', configArg);
      return;
    }
    if (!/^[A-Z][A-Za-z0-9]*$/.test(config.name)) {
      fail(`Component name "${config.name}" must be PascalCase.`, configArg);
      return;
    }

    const exportName = resolveExportName(call);
    if (!exportName) {
      warn(
        `The defineIMDX result for "${config.name}" is not exported; it cannot be imported into the registry.`,
      );
    }

    // ---- Infer props from the component's TypeScript type ----------------
    const inferred = new Map<string, PropSpec>();
    let hasChildrenProp = false;

    const componentType = checker.getTypeAtLocation(componentArg);
    const signature = componentType.getCallSignatures()[0];
    const propsParam = signature?.getParameters()[0];
    if (propsParam) {
      const propsType = checker.getTypeOfSymbolAtLocation(propsParam, componentArg);
      for (const symbol of propsType.getProperties()) {
        const name = symbol.getName();
        const decl = symbol.valueDeclaration ?? symbol.declarations?.[0] ?? componentArg;
        const type = checker.getTypeOfSymbolAtLocation(symbol, decl);
        const required = !(symbol.flags & ts.SymbolFlags.Optional);

        if (name === "children") {
          hasChildrenProp = true;
          continue;
        }
        if (isFunctionType(type)) {
          if (required) {
            fail(
              `Prop "${name}" of "${config.name}" is a required function — it can never be expressed in iMDX content. Make it optional or remove it.`,
            );
          } else {
            warn(
              `Prop "${name}" of "${config.name}" is function-typed and was excluded from the editable spec.`,
            );
          }
          continue;
        }

        const description = ts.displayPartsToString(
          symbol.getDocumentationComment(checker),
        );
        inferred.set(name, {
          name,
          required,
          control: inferControl(type, checker),
          ...(description ? { description } : {}),
        });
      }
    } else {
      warn(
        `Could not resolve a props type for "${config.name}"; only explicitly configured props will be included.`,
      );
    }

    // ---- Overlay explicit config ------------------------------------------
    const overrides = config.props ?? {};
    for (const [propName, override] of Object.entries(overrides)) {
      const base = inferred.get(propName);
      if (!base) {
        warn(
          `Config for "${config.name}" declares prop "${propName}" which does not exist on the component's props type.`,
        );
        continue;
      }
      if (override.control) base.control = override.control;
      if (override.default !== undefined) base.default = override.default as JsonValue;
      if (override.description) base.description = override.description;
      if (override.required !== undefined) base.required = override.required;
      if (
        "placeholder" in override &&
        typeof override.placeholder === "string" &&
        (base.control.type === "text" || base.control.type === "textarea")
      ) {
        base.control = { ...base.control, placeholder: override.placeholder };
      }
    }

    const childrenPolicy =
      config.children ?? (hasChildrenProp ? "blocks" : "none");
    if (!hasChildrenProp && config.children && config.children !== "none") {
      warn(
        `"${config.name}" declares children policy "${config.children}" but its props type has no "children" prop.`,
      );
    }

    const spec: ComponentSpec = {
      name: config.name,
      ...(config.category ? { category: config.category } : {}),
      ...(config.icon ? { icon: config.icon } : {}),
      ...(config.description ? { description: config.description } : {}),
      ...(config.version !== undefined ? { version: config.version } : {}),
      source: rel,
      children: { policy: childrenPolicy },
      props: [...inferred.values()],
      constraints: {
        allowedParents: config.constraints?.allowedParents ?? null,
        allowedChildren: config.constraints?.allowedChildren ?? null,
      },
      render: { mode: config.render?.mode ?? "live" },
    };

    components.push({ spec, file: sf.fileName, exportName: exportName ?? "default" });
  }
}

function isDefineIMDXCall(node: ts.Node): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "defineIMDX"
  );
}

/** Walk up from the call to find how its result is exported. */
function resolveExportName(call: ts.CallExpression): string | null {
  let node: ts.Node = call;
  while (node.parent) {
    const parent: ts.Node = node.parent;
    if (ts.isExportAssignment(parent)) return "default";
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      const statement = parent.parent?.parent;
      if (
        statement &&
        ts.isVariableStatement(statement) &&
        statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        return parent.name.text;
      }
      return null;
    }
    if (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent)) {
      node = parent;
      continue;
    }
    return null;
  }
  return null;
}

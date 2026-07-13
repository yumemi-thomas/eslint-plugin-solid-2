import { ASTUtils, TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import { isFunctionNode, trace, type FunctionNode } from "../utils.js";
import { isSolidJsImportDeclaration } from "./solid-bindings.js";
import { getTypeAwareServices, resolveTypeAwareSolidCallee } from "./typescript-semantics.js";

type RuleContext = Readonly<TSESLint.RuleContext<string, readonly unknown[]>>;

const CONTROL_FLOW_NAMES = new Set(["For", "Match", "Repeat", "Show"]);

function importedControlFlowName(
  name: T.JSXTagNameExpression,
  context: RuleContext,
): string | null {
  if (name.type === "JSXIdentifier") {
    const variable = ASTUtils.findVariable(context.sourceCode.getScope(name), name.name);
    for (const def of variable?.defs ?? []) {
      if (
        def.type === "ImportBinding" &&
        def.node.type === "ImportSpecifier" &&
        isSolidJsImportDeclaration(def.node.parent)
      ) {
        const imported =
          def.node.imported.type === "Identifier"
            ? def.node.imported.name
            : def.node.imported.value;
        return CONTROL_FLOW_NAMES.has(imported) ? imported : null;
      }
    }
    return null;
  }

  if (
    name.type === "JSXMemberExpression" &&
    name.object.type === "JSXIdentifier" &&
    name.property.type === "JSXIdentifier" &&
    CONTROL_FLOW_NAMES.has(name.property.name)
  ) {
    const variable = ASTUtils.findVariable(
      context.sourceCode.getScope(name.object),
      name.object.name,
    );
    const namespaceImport = variable?.defs.some(
      (def) =>
        def.type === "ImportBinding" &&
        def.node.type === "ImportNamespaceSpecifier" &&
        isSolidJsImportDeclaration(def.node.parent),
    );
    return namespaceImport === true ? name.property.name : null;
  }

  return null;
}

function provenControlFlowName(name: T.JSXTagNameExpression, context: RuleContext): string | null {
  const imported = importedControlFlowName(name, context);
  if (imported != null) {
    return imported;
  }
  const typescriptEnabled = (context.options[0] as { typescriptEnabled?: boolean } | undefined)
    ?.typescriptEnabled;
  const services = typescriptEnabled ? getTypeAwareServices(context) : null;
  return services == null ? null : resolveTypeAwareSolidCallee(name, services, CONTROL_FLOW_NAMES);
}

function resolveFunction(
  value: T.Node | null | undefined,
  context: RuleContext,
): FunctionNode | null {
  if (value == null || value.type === "SpreadElement") {
    return null;
  }
  if (isFunctionNode(value)) {
    return value;
  }
  const resolved = trace(value, context);
  return isFunctionNode(resolved) ? resolved : null;
}

function keyedMode(
  element: T.JSXElement,
  context: RuleContext,
): "absent" | "false" | "true" | "custom" | "unknown" {
  const keyed = element.openingElement.attributes.find(
    (attribute): attribute is T.JSXAttribute =>
      attribute.type === "JSXAttribute" &&
      attribute.name.type === "JSXIdentifier" &&
      attribute.name.name === "keyed",
  );
  if (!keyed) {
    return "absent";
  }
  if (keyed.value == null) {
    return "true";
  }
  if (keyed.value.type !== "JSXExpressionContainer") {
    return "unknown";
  }
  const value = keyed.value.expression;
  if (value.type === "Literal" && value.value === true) {
    return "true";
  }
  if (value.type === "Literal" && value.value === false) {
    return "false";
  }
  if (resolveFunction(value, context) != null) {
    return "custom";
  }
  return "unknown";
}

function accessorParameters(
  fn: FunctionNode,
  controlFlowName: string,
  element: T.JSXElement,
  context: RuleContext,
): T.Identifier[] {
  const identifiers = fn.params.map((param) => (param.type === "Identifier" ? param : null));
  const mode = keyedMode(element, context);
  if (controlFlowName === "For") {
    if (mode === "false") {
      return identifiers[0] ? [identifiers[0]] : [];
    }
    if (mode === "custom") {
      return identifiers.filter((param): param is T.Identifier => param != null);
    }
    if (mode === "absent" || mode === "true") {
      return identifiers[1] ? [identifiers[1]] : [];
    }
    return [];
  }
  if (controlFlowName === "Show" || controlFlowName === "Match") {
    return mode === "absent" || mode === "false" ? (identifiers[0] ? [identifiers[0]] : []) : [];
  }
  return [];
}

export interface ControlFlowFunctionChild {
  function: FunctionNode;
  accessorParameters: readonly T.Identifier[];
}

function functionsFromElement(
  element: T.JSXElement,
  context: RuleContext,
): ControlFlowFunctionChild[] {
  const controlFlowName = provenControlFlowName(element.openingElement.name, context);
  if (controlFlowName == null) {
    return [];
  }
  const functions: ControlFlowFunctionChild[] = [];
  const add = (fn: FunctionNode): void => {
    functions.push({
      function: fn,
      accessorParameters: accessorParameters(fn, controlFlowName, element, context),
    });
  };
  for (const attribute of element.openingElement.attributes) {
    if (
      attribute.type === "JSXAttribute" &&
      attribute.name.type === "JSXIdentifier" &&
      attribute.name.name === "children" &&
      attribute.value?.type === "JSXExpressionContainer"
    ) {
      const fn = resolveFunction(attribute.value.expression, context);
      if (fn) {
        add(fn);
      }
    }
  }
  for (const child of element.children) {
    if (child.type !== "JSXExpressionContainer") {
      continue;
    }
    const fn = resolveFunction(child.expression, context);
    if (fn) {
      add(fn);
    }
  }
  return functions;
}

function childNodes(node: T.Node): T.Node[] {
  const result: T.Node[] = [];
  for (const key in node) {
    if (key === "parent" || key === "tokens" || key === "comments") {
      continue;
    }
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null && typeof item === "object" && typeof (item as T.Node).type === "string") {
          result.push(item as T.Node);
        }
      }
    } else if (
      value != null &&
      typeof value === "object" &&
      typeof (value as T.Node).type === "string"
    ) {
      result.push(value as T.Node);
    }
  }
  return result;
}

/** Finds binding-proven Solid control-flow function children inside a component body. */
export function getControlFlowFunctionChildren(
  component: FunctionNode,
  context: RuleContext,
): ControlFlowFunctionChild[] {
  const functions: ControlFlowFunctionChild[] = [];
  const seenFunctions = new Set<FunctionNode>();
  const stack: T.Node[] = [component.body];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node !== component.body && isFunctionNode(node)) {
      continue;
    }
    if (node.type === "JSXElement") {
      for (const child of functionsFromElement(node, context)) {
        if (seenFunctions.has(child.function)) {
          continue;
        }
        seenFunctions.add(child.function);
        functions.push(child);
        // Traverse only into functions proven to be Solid control-flow children.
        // This finds nested control flow without treating arbitrary closures as
        // eagerly executed reactive scopes.
        stack.push(child.function.body);
      }
    }
    stack.push(...childNodes(node));
  }
  return functions;
}

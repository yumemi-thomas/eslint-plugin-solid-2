import { ASTUtils, TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import { isFunctionNode } from "../utils.js";
import { bindsToSolid, getReactiveBindingFactForVariable } from "./solid-bindings.js";
import {
  getTypeAwareServices,
  isSolidAccessorExpression,
  type TypeAwareServices,
} from "./typescript-semantics.js";

type RuleContext = Readonly<TSESLint.RuleContext<string, readonly unknown[]>>;

const UNTRACK_NAMES = new Set(["untrack"]);

export interface ReactiveReadEnvironment {
  propsVariables?: ReadonlySet<TSESLint.Scope.Variable>;
  accessorVariables?: ReadonlySet<TSESLint.Scope.Variable>;
  typescript?: TypeAwareServices | null;
}

export type ReactiveReadKind = "accessor" | "props" | "store";

export interface ReactiveRead {
  kind: ReactiveReadKind;
  node: T.Node;
}

export function getReactiveReadTypeServices(context: RuleContext): TypeAwareServices | null {
  const enabled = (context.options[0] as { typescriptEnabled?: boolean } | undefined)
    ?.typescriptEnabled;
  return enabled ? getTypeAwareServices(context) : null;
}

function variableFor(node: T.Identifier, context: RuleContext): TSESLint.Scope.Variable | null {
  return ASTUtils.findVariable(context.sourceCode.getScope(node), node);
}

function rootIdentifier(node: T.MemberExpression): T.Identifier | null {
  let root: T.Expression = node;
  while (root.type === "MemberExpression") {
    root = root.object;
  }
  return root.type === "Identifier" ? root : null;
}

function variableRole(
  variable: TSESLint.Scope.Variable | null,
  environment: ReactiveReadEnvironment,
  context: RuleContext,
): ReactiveReadKind | null {
  if (variable == null) {
    return null;
  }
  if (environment.propsVariables?.has(variable)) {
    return "props";
  }
  if (environment.accessorVariables?.has(variable)) {
    return "accessor";
  }
  const fact = getReactiveBindingFactForVariable(variable, context);
  return fact?.role === "accessor" ? "accessor" : fact?.role === "store" ? "store" : null;
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

/** Finds the first provable reactive read executed directly in a structure-building scope. */
export function findReactiveRead(
  root: T.Node,
  environment: ReactiveReadEnvironment,
  context: RuleContext,
): ReactiveRead | null {
  const stack: T.Node[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (isFunctionNode(node) || node.type === "JSXElement" || node.type === "JSXFragment") {
      continue;
    }
    if (node.type === "CallExpression") {
      if (bindsToSolid(node.callee, context, UNTRACK_NAMES)) {
        continue;
      }
      const callee = node.callee;
      if (callee.type === "Identifier") {
        const role = variableRole(variableFor(callee, context), environment, context);
        if (role === "accessor") {
          return { kind: "accessor", node };
        }
      }
      if (
        environment.typescript != null &&
        isSolidAccessorExpression(callee, environment.typescript)
      ) {
        return { kind: "accessor", node };
      }
    }
    if (
      node.type === "VariableDeclarator" &&
      (node.id.type === "ObjectPattern" || node.id.type === "ArrayPattern") &&
      node.init?.type === "Identifier"
    ) {
      const role = variableRole(variableFor(node.init, context), environment, context);
      if (role === "props" || role === "store") {
        return { kind: role, node };
      }
    }
    if (
      node.type === "AssignmentExpression" &&
      (node.left.type === "ObjectPattern" || node.left.type === "ArrayPattern") &&
      node.right.type === "Identifier"
    ) {
      const role = variableRole(variableFor(node.right, context), environment, context);
      if (role === "props" || role === "store") {
        return { kind: role, node };
      }
    }
    if (node.type === "MemberExpression") {
      const rootId = rootIdentifier(node);
      const role = rootId ? variableRole(variableFor(rootId, context), environment, context) : null;
      if (role === "props" || role === "store") {
        return { kind: role, node };
      }
    }
    if (node.type === "SpreadElement" && node.argument.type === "Identifier") {
      const role = variableRole(variableFor(node.argument, context), environment, context);
      if (role === "props" || role === "store") {
        return { kind: role, node };
      }
    }
    stack.push(...childNodes(node));
  }
  return null;
}

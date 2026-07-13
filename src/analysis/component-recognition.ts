import * as ts from "typescript";
import { ASTUtils, TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import { getFunctionName, isDOMElementName, type FunctionNode } from "../utils.js";
import { isSolidJsImportDeclaration } from "./solid-bindings.js";
import {
  getTypeAwareServices,
  resolveTypeScriptAlias,
  type TypeAwareServices,
} from "./typescript-semantics.js";

type RuleContext = Readonly<TSESLint.RuleContext<string, readonly unknown[]>>;

const SOLID_COMPONENT_TYPES = new Set([
  "Component",
  "VoidComponent",
  "ParentComponent",
  "FlowComponent",
]);

function typeReferenceName(node: T.TypeNode | undefined): string | null {
  if (node?.type !== "TSTypeReference") {
    return null;
  }
  if (node.typeName.type === "Identifier") {
    return node.typeName.name;
  }
  if (node.typeName.type === "TSQualifiedName" && node.typeName.right.type === "Identifier") {
    return node.typeName.right.name;
  }
  return null;
}

function typeReferenceRootIdentifier(
  node: T.TypeNode | undefined,
): { id: T.Identifier; qualified: boolean } | null {
  if (node?.type !== "TSTypeReference") {
    return null;
  }
  let name: T.EntityName = node.typeName;
  let qualified = false;
  while (name.type === "TSQualifiedName") {
    qualified = true;
    name = name.left;
  }
  return name.type === "Identifier" ? { id: name, qualified } : null;
}

function typeNameBindsToSolid(id: T.Identifier, qualified: boolean, context: RuleContext): boolean {
  let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope(id);
  while (scope) {
    for (const variable of scope.variables) {
      if (variable.name !== id.name) {
        continue;
      }
      for (const def of variable.defs) {
        if (def.type === "ImportBinding") {
          return isSolidJsImportDeclaration(def.node.parent);
        }
        if (def.type === "Type" || def.type === "ClassName" || def.type === "TSEnumName") {
          return false;
        }
      }
    }
    scope = scope.upper;
  }
  return !qualified;
}

export function hasSolidComponentTypeAnnotation(node: FunctionNode, context: RuleContext): boolean {
  const parent = node.parent;
  if (parent?.type !== "VariableDeclarator" || parent.id.type !== "Identifier") {
    return false;
  }
  const annotation = parent.id.typeAnnotation?.typeAnnotation;
  const name = typeReferenceName(annotation);
  if (name == null || !SOLID_COMPONENT_TYPES.has(name)) {
    return false;
  }
  const root = typeReferenceRootIdentifier(annotation);
  return root != null && typeNameBindsToSolid(root.id, root.qualified, context);
}

const inFileComponentVarsCache = new WeakMap<
  TSESLint.SourceCode,
  ReadonlySet<TSESLint.Scope.Variable>
>();

function getInFileComponentVariables(
  sourceCode: TSESLint.SourceCode,
): ReadonlySet<TSESLint.Scope.Variable> {
  const cached = inFileComponentVarsCache.get(sourceCode);
  if (cached) {
    return cached;
  }
  const variables = new Set<TSESLint.Scope.Variable>();
  const stack: T.Node[] = [sourceCode.ast];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (
      node.type === "JSXOpeningElement" &&
      node.name.type === "JSXIdentifier" &&
      !isDOMElementName(node.name.name)
    ) {
      const variable = ASTUtils.findVariable(sourceCode.getScope(node.name), node.name.name);
      if (variable) {
        variables.add(variable);
      }
    }
    for (const key in node) {
      if (key === "parent" || key === "tokens" || key === "comments") {
        continue;
      }
      const value = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (
            item != null &&
            typeof item === "object" &&
            typeof (item as T.Node).type === "string"
          ) {
            stack.push(item as T.Node);
          }
        }
      } else if (
        value != null &&
        typeof value === "object" &&
        typeof (value as T.Node).type === "string"
      ) {
        stack.push(value as T.Node);
      }
    }
  }
  inFileComponentVarsCache.set(sourceCode, variables);
  return variables;
}

const jsxTagSymbolsCache = new WeakMap<ts.Program, ReadonlySet<ts.Symbol>>();

function getJsxTagSymbols(services: TypeAwareServices): ReadonlySet<ts.Symbol> {
  const cached = jsxTagSymbolsCache.get(services.program);
  if (cached) {
    return cached;
  }
  const checker = services.program.getTypeChecker();
  const symbols = new Set<ts.Symbol>();
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const symbol = checker.getSymbolAtLocation(node.tagName);
      if (symbol) {
        symbols.add(resolveTypeScriptAlias(symbol, checker));
      }
    }
    ts.forEachChild(node, visit);
  };
  for (const sourceFile of services.program.getSourceFiles()) {
    if (!sourceFile.isDeclarationFile && !sourceFile.fileName.includes("/node_modules/")) {
      visit(sourceFile);
    }
  }
  jsxTagSymbolsCache.set(services.program, symbols);
  return symbols;
}

function getFunctionSymbol(node: FunctionNode, services: TypeAwareServices): ts.Symbol | undefined {
  let nameNode: T.Identifier | undefined;
  if (
    (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") &&
    node.id != null
  ) {
    nameNode = node.id;
  } else if (node.parent?.type === "VariableDeclarator" && node.parent.id.type === "Identifier") {
    nameNode = node.parent.id;
  }
  if (!nameNode) {
    return undefined;
  }
  const tsNode = services.esTreeNodeToTSNodeMap.get(nameNode);
  return tsNode ? services.program.getTypeChecker().getSymbolAtLocation(tsNode) : undefined;
}

const baseEvidenceCache = new WeakMap<TSESLint.SourceCode, WeakMap<FunctionNode, boolean>>();
const typeAwareEvidenceCache = new WeakMap<TSESLint.SourceCode, WeakMap<FunctionNode, boolean>>();

function cachedEvidence(
  cache: WeakMap<TSESLint.SourceCode, WeakMap<FunctionNode, boolean>>,
  sourceCode: TSESLint.SourceCode,
  node: FunctionNode,
  compute: () => boolean,
): boolean {
  let byFunction = cache.get(sourceCode);
  if (!byFunction) {
    byFunction = new WeakMap();
    cache.set(sourceCode, byFunction);
  }
  const cached = byFunction.get(node);
  if (cached !== undefined) {
    return cached;
  }
  const evidence = compute();
  byFunction.set(node, evidence);
  return evidence;
}

function hasBaseEvidence(node: FunctionNode, context: RuleContext): boolean {
  return cachedEvidence(baseEvidenceCache, context.sourceCode, node, () => {
    if (hasSolidComponentTypeAnnotation(node, context)) {
      return true;
    }
    const name = getFunctionName(node);
    if (name == null) {
      return false;
    }
    const variable = ASTUtils.findVariable(context.sourceCode.getScope(node), name);
    return variable != null && getInFileComponentVariables(context.sourceCode).has(variable);
  });
}

function hasTypeAwareEvidence(node: FunctionNode, context: RuleContext): boolean {
  return cachedEvidence(typeAwareEvidenceCache, context.sourceCode, node, () => {
    const services = getTypeAwareServices(context);
    if (!services) {
      return false;
    }
    const checker = services.program.getTypeChecker();
    const symbol = getFunctionSymbol(node, services);
    return (
      symbol != null && getJsxTagSymbols(services).has(resolveTypeScriptAlias(symbol, checker))
    );
  });
}

/** Sound, self-indexing Solid component recognition. See ADR-0002. */
export function isComponent(node: FunctionNode, context: RuleContext): boolean {
  if (hasBaseEvidence(node, context)) {
    return true;
  }
  const typescriptEnabled = (context.options[0] as { typescriptEnabled?: boolean } | undefined)
    ?.typescriptEnabled;
  return typescriptEnabled === true && hasTypeAwareEvidence(node, context);
}

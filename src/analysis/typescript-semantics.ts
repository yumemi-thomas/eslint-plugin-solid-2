import * as ts from "typescript";
import { TSESLint, TSESTree as T } from "@typescript-eslint/utils";

type RuleContext = Readonly<TSESLint.RuleContext<string, readonly unknown[]>>;

export interface TypeAwareServices {
  program: ts.Program;
  esTreeNodeToTSNodeMap: { get(node: T.Node): ts.Node | undefined };
}

export function getTypeAwareServices(context: RuleContext): TypeAwareServices | null {
  const services = context.sourceCode.parserServices;
  if (services?.program != null && services.esTreeNodeToTSNodeMap != null) {
    return services as unknown as TypeAwareServices;
  }
  return null;
}

export function resolveTypeScriptAlias(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

const SOLID_ACCESSOR_TYPE_NAMES = new Set(["Accessor", "SourceAccessor"]);

function isSolidOrigin(text: string): boolean {
  return text.includes("solid-js") || text.includes("@solidjs") || text.includes("solid-signals");
}

const solidSymbolCache = new WeakMap<ts.Symbol, boolean>();

export function symbolIsFromSolid(symbol: ts.Symbol, checker: ts.TypeChecker): boolean {
  const cached = solidSymbolCache.get(symbol);
  if (cached !== undefined) {
    return cached;
  }
  const result =
    isSolidOrigin(checker.getFullyQualifiedName(symbol)) ||
    (symbol.getDeclarations() ?? []).some((declaration) =>
      isSolidOrigin(declaration.getSourceFile().fileName),
    );
  solidSymbolCache.set(symbol, result);
  return result;
}

function collectTypeParts(
  type: ts.Type,
  acc: ts.Type[] = [],
  seen = new Set<ts.Type>(),
): ts.Type[] {
  if (seen.has(type)) {
    return acc;
  }
  seen.add(type);
  acc.push(type);
  if (type.isUnion() || type.isIntersection()) {
    for (const member of type.types) {
      collectTypeParts(member, acc, seen);
    }
  }
  return acc;
}

const solidAccessorNodeCache = new WeakMap<ts.Node, boolean>();

export function isSolidAccessorExpression(
  node: T.Expression,
  services: TypeAwareServices,
): boolean {
  const tsNode = services.esTreeNodeToTSNodeMap.get(node);
  if (!tsNode) {
    return false;
  }
  const cached = solidAccessorNodeCache.get(tsNode);
  if (cached !== undefined) {
    return cached;
  }
  const checker = services.program.getTypeChecker();
  const result = collectTypeParts(checker.getTypeAtLocation(tsNode)).some((part) => {
    const alias = part.aliasSymbol;
    return (
      alias != null &&
      SOLID_ACCESSOR_TYPE_NAMES.has(alias.getName()) &&
      symbolIsFromSolid(alias, checker)
    );
  });
  solidAccessorNodeCache.set(tsNode, result);
  return result;
}

export function resolveTypeAwareSolidCallee(
  node: T.Node,
  services: TypeAwareServices,
  canonicalNames: ReadonlySet<string>,
): string | null {
  const tsNode = services.esTreeNodeToTSNodeMap.get(node);
  if (!tsNode) {
    return null;
  }
  const checker = services.program.getTypeChecker();
  const symbol = checker.getSymbolAtLocation(tsNode);
  if (!symbol) {
    return null;
  }
  const resolved = resolveTypeScriptAlias(symbol, checker);
  const name = resolved.getName();
  return canonicalNames.has(name) && symbolIsFromSolid(resolved, checker) ? name : null;
}

export function isTypeAwareSolidCallee(
  node: T.Node,
  services: TypeAwareServices,
  canonicalNames: ReadonlySet<string>,
): boolean {
  return resolveTypeAwareSolidCallee(node, services, canonicalNames) != null;
}

import { ASTUtils, TSESLint, TSESTree as T } from "@typescript-eslint/utils";

const domElementRegex = /^[a-z]/;

export const isDOMElementName = (name: string): boolean => domElementRegex.test(name);

/**
 * Whether a JSX opening element is a host (DOM) element rather than a custom component. DOM-only
 * DOM-only rules must skip components, whose attributes are author-defined props with no DOM
 * semantics. A lowercase tag (`<div>`) or a namespaced tag (`<svg:rect>`) is a
 * host element; a capitalized tag (`<Card>`) or a member tag (`<Foo.Bar>`) is a component.
 */
export const isHostElement = (opening: T.JSXOpeningElement): boolean => {
  const tag = opening.name;
  if (tag.type === "JSXIdentifier") {
    return isDOMElementName(tag.name);
  }

  return tag.type === "JSXNamespacedName";
};

export type FunctionNode = T.FunctionDeclaration | T.FunctionExpression | T.ArrowFunctionExpression;

export const getFunctionName = (node: FunctionNode): string | null => {
  if (
    (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") &&
    node.id != null
  ) {
    return node.id.name;
  }

  if (node.parent?.type === "VariableDeclarator" && node.parent.id.type === "Identifier") {
    return node.parent.id.name;
  }

  return null;
};

export const isFunctionNode = (node: T.Node | null | undefined): node is FunctionNode =>
  node?.type === "FunctionDeclaration" ||
  node?.type === "FunctionExpression" ||
  node?.type === "ArrowFunctionExpression";

export const isJSXElementOrFragment = (
  node: T.Node | null | undefined,
): node is T.JSXElement | T.JSXFragment =>
  node?.type === "JSXElement" || node?.type === "JSXFragment";

export const trace = (
  node: T.Node,
  context: Readonly<TSESLint.RuleContext<string, readonly unknown[]>>,
): T.Node => {
  if (node.type !== "Identifier") {
    return node;
  }

  const variable = ASTUtils.findVariable(context.sourceCode.getScope(node), node);
  const def = variable?.defs[0];
  if (!variable || !def) {
    return node;
  }

  switch (def.type) {
    case "FunctionName":
    case "ClassName":
    case "ImportBinding":
      return def.node;
    case "Variable": {
      const declaration = def.node.parent;
      if (
        declaration?.type === "VariableDeclaration" &&
        declaration.kind === "const" &&
        def.node.id.type === "Identifier" &&
        def.node.init
      ) {
        return trace(def.node.init, context);
      }

      return node;
    }
    default:
      return node;
  }
};

export const getCommentBefore = (
  node: T.Node,
  sourceCode: TSESLint.SourceCode,
): T.Comment | undefined =>
  sourceCode
    .getCommentsBefore(node)
    .find((comment) => comment.loc!.end.line >= node.loc!.start.line - 1);

export function appendImports(
  fixer: TSESLint.RuleFixer,
  sourceCode: TSESLint.SourceCode,
  importNode: T.ImportDeclaration,
  specifiers: string[],
): TSESLint.RuleFix | null {
  const text = specifiers.join(", ");
  const lastNamed = [...importNode.specifiers]
    .reverse()
    .find((specifier) => specifier.type === "ImportSpecifier");

  if (lastNamed) {
    return fixer.insertTextAfter(lastNamed, `, ${text}`);
  }

  const namespaceOrDefault = importNode.specifiers.find(
    (specifier) =>
      specifier.type === "ImportDefaultSpecifier" || specifier.type === "ImportNamespaceSpecifier",
  );
  if (namespaceOrDefault) {
    return fixer.insertTextAfter(namespaceOrDefault, `, { ${text} }`);
  }

  const [importToken, maybeBrace] = sourceCode.getFirstTokens(importNode, { count: 2 });
  if (maybeBrace?.value === "{") {
    return fixer.insertTextAfter(maybeBrace, ` ${text} `);
  }

  return importToken ? fixer.insertTextAfter(importToken, ` { ${text} } from`) : null;
}

export function insertImports(
  fixer: TSESLint.RuleFixer,
  sourceCode: TSESLint.SourceCode,
  source: string,
  specifiers: string[],
  aboveImport?: T.ImportDeclaration,
  isType = false,
): TSESLint.RuleFix {
  const firstImport =
    aboveImport ??
    sourceCode.ast.body.find(
      (node): node is T.ImportDeclaration => node.type === "ImportDeclaration",
    );
  const importText = `import ${isType ? "type " : ""}{ ${specifiers.join(", ")} } from "${source}";\n`;

  if (firstImport) {
    return fixer.insertTextBeforeRange(
      (getCommentBefore(firstImport, sourceCode) ?? firstImport).range,
      importText,
    );
  }

  return fixer.insertTextBeforeRange([0, 0], importText);
}

export function removeSpecifier(
  fixer: TSESLint.RuleFixer,
  sourceCode: TSESLint.SourceCode,
  specifier: T.ImportSpecifier,
): TSESLint.RuleFix {
  const declaration = specifier.parent as T.ImportDeclaration;
  if (declaration.specifiers.length === 1) {
    return fixer.remove(declaration);
  }

  const maybeComma = sourceCode.getTokenAfter(specifier);
  if (maybeComma?.value === ",") {
    return fixer.removeRange([specifier.range[0], maybeComma.range[1]]);
  }

  const maybeCommaBefore = sourceCode.getTokenBefore(specifier);
  if (maybeCommaBefore?.value === ",") {
    return fixer.removeRange([maybeCommaBefore.range[0], specifier.range[1]]);
  }

  return fixer.remove(specifier);
}

export function jsxPropName(prop: T.JSXAttribute): string {
  if (prop.name.type === "JSXNamespacedName") {
    return `${prop.name.namespace.name}:${prop.name.name.name}`;
  }

  return prop.name.name;
}

type Props = T.JSXOpeningElement["attributes"];

export function* jsxGetAllProps(props: Props): Generator<[string, T.Node]> {
  for (const attr of props) {
    if (attr.type === "JSXSpreadAttribute" && attr.argument.type === "ObjectExpression") {
      for (const property of attr.argument.properties) {
        if (property.type === "Property") {
          if (property.key.type === "Identifier") {
            yield [property.key.name, property.key];
          } else if (property.key.type === "Literal") {
            yield [String(property.key.value), property.key];
          }
        }
      }
      continue;
    }

    if (attr.type === "JSXAttribute") {
      yield [jsxPropName(attr), attr.name];
    }
  }
}

export const jsxHasProp = (props: Props, prop: string): boolean => {
  for (const [name] of jsxGetAllProps(props)) {
    if (name === prop) {
      return true;
    }
  }

  return false;
};

export const jsxGetProp = (props: Props, prop: string): T.JSXAttribute | undefined =>
  props.find(
    (attribute): attribute is T.JSXAttribute =>
      attribute.type === "JSXAttribute" && jsxPropName(attribute) === prop,
  );

export const formatList = (strings: string[]): string => {
  if (strings.length === 0) {
    return "";
  }

  if (strings.length === 1) {
    return `'${strings[0]}'`;
  }

  if (strings.length === 2) {
    return `'${strings[0]}' and '${strings[1]}'`;
  }

  const last = strings.length - 1;
  return `${strings
    .slice(0, last)
    .map((value) => `'${value}'`)
    .join(", ")}, and '${strings[last]}'`;
};

export const markVariableAsUsed = (
  context: Readonly<TSESLint.RuleContext<string, readonly unknown[]>>,
  name: string,
  node: T.Node,
): boolean => context.sourceCode.markVariableAsUsed(name, node);

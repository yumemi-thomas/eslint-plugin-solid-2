import { ASTUtils, ESLintUtils, TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import type { FunctionNode } from "../utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

const getName = (node: T.Node): string | null => {
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string" ? node.value : null;
    case "Identifier":
      return node.name;
    case "AssignmentPattern":
      return getName(node.left);
    default:
      return ASTUtils.getStringIfConstant(node);
  }
};

interface PropertyInfo {
  init: T.Expression | undefined;
  computed: boolean;
  real: T.Expression | T.Identifier | T.Literal;
  variableName: string;
}

function isNameTaken(sourceCode: TSESLint.SourceCode, name: string): boolean {
  return sourceCode.scopeManager?.scopes.some((scope) => scope.set.has(name)) ?? false;
}

const getPropertyInfo = (property: T.Property): PropertyInfo | null => {
  const variableName = getName(property.value);
  if (variableName === null) {
    return null;
  }

  return {
    init: property.value.type === "AssignmentPattern" ? property.value.right : undefined,
    computed: property.computed,
    real: property.key,
    variableName,
  };
};

export default createRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow destructuring component props. In Solid 2, destructuring props triggers top-level untracked reads.",
    },
    fixable: "code",
    schema: [],
    messages: {
      noDestructure:
        "Destructuring component props breaks Solid 2 reactivity; keep the `props` object and read properties from it.",
    },
  },
  defaultOptions: [],
  create(context) {
    const functionStack: Array<{ hasJSX: boolean }> = [];
    const currentFunction = () => functionStack[functionStack.length - 1];

    const onFunctionEnter = () => {
      functionStack.push({ hasJSX: false });
    };

    const onFunctionExit = (node: FunctionNode) => {
      const props = node.params[0];
      if (
        node.params.length === 1 &&
        props?.type === "ObjectPattern" &&
        currentFunction()?.hasJSX &&
        node.parent?.type !== "JSXExpressionContainer"
      ) {
        context.report({
          node: props,
          messageId: "noDestructure",
          fix: (fixer) => fixDestructure(node, props, fixer),
        });
      }

      functionStack.pop();
    };

    function* fixDestructure(
      func: FunctionNode,
      props: T.ObjectPattern,
      fixer: TSESLint.RuleFixer,
    ): Generator<TSESLint.RuleFix> {
      const sourceCode = context.sourceCode;
      const importNode = sourceCode.ast.body.find(
        (node): node is T.ImportDeclaration =>
          node.type === "ImportDeclaration" &&
          node.importKind !== "type" &&
          node.source.type === "Literal" &&
          node.source.value === "solid-js",
      );
      const properties = props.properties;
      const propEntries: PropertyInfo[] = [];
      let rest: T.RestElement | null = null;

      for (const property of properties) {
        if (property.type === "RestElement") {
          rest = property;
          continue;
        }

        const info = getPropertyInfo(property);
        if (info) {
          propEntries.push(info);
        }
      }

      const hasDefaults = propEntries.some((entry) => entry.init);
      const propsName = "props";
      const originalPropsName = hasDefaults ? "_props" : propsName;

      const helperNames = new Map<string, string>();
      if (importNode) {
        for (const specifier of importNode.specifiers) {
          if (specifier.type !== "ImportSpecifier") {
            continue;
          }

          const importedName =
            specifier.imported.type === "Identifier"
              ? specifier.imported.name
              : specifier.imported.value;
          if (importedName === "merge" || importedName === "omit") {
            helperNames.set(importedName, specifier.local.name);
          }
        }
      }

      const resolveHelper = (importedName: "merge" | "omit"): string | null => {
        const existing = helperNames.get(importedName);
        if (existing) {
          return existing;
        }

        return isNameTaken(sourceCode, importedName) ? null : importedName;
      };

      const mergeName = hasDefaults ? resolveHelper("merge") : null;
      const omitName = rest ? resolveHelper("omit") : null;

      const defaultPairs = propEntries
        .filter((entry) => entry.init)
        .map((entry) => {
          const key = entry.computed
            ? `[${sourceCode.getText(entry.real)}]`
            : sourceCode.getText(entry.real);
          return `${key}: ${sourceCode.getText(entry.init!)}`;
        });

      const omittedKeys = propEntries.map((entry) =>
        entry.real.type === "Identifier"
          ? JSON.stringify(entry.real.name)
          : sourceCode.getText(entry.real),
      );

      const setupLines: string[] = [];
      if ((hasDefaults && mergeName == null) || (rest && omitName == null)) {
        return;
      }

      if (hasDefaults) {
        setupLines.push(
          `const ${propsName} = ${mergeName}({ ${defaultPairs.join(", ")} }, ${originalPropsName});`,
        );
      }
      if (rest) {
        const restName = rest.argument.type === "Identifier" ? rest.argument.name : "rest";
        const omitArgs = omittedKeys.length > 0 ? `, ${omittedKeys.join(", ")}` : "";
        setupLines.push(`const ${restName} = ${omitName}(${propsName}${omitArgs});`);
      }

      if (setupLines.length > 0 && func.body.type !== "BlockStatement") {
        return;
      }

      if (props.typeAnnotation) {
        yield fixer.replaceTextRange(
          [props.range[0], props.typeAnnotation.range[0]],
          originalPropsName,
        );
      } else {
        yield fixer.replaceText(props, originalPropsName);
      }

      if (setupLines.length > 0) {
        if (func.body.type === "BlockStatement") {
          const indent = " ".repeat(func.body.body[0]?.loc?.start.column ?? 2);
          if (func.body.body.length > 0) {
            yield fixer.insertTextBefore(
              func.body.body[0],
              `${setupLines.join(`\n${indent}`)}\n${indent}`,
            );
          } else {
            yield fixer.insertTextAfterRange(
              [func.body.range[0], func.body.range[0] + 1],
              `\n${indent}${setupLines.join(`\n${indent}`)}\n`,
            );
          }
        }
      }

      const scope = sourceCode.scopeManager?.acquire(func);
      if (!scope) {
        return;
      }

      for (const entry of propEntries) {
        const variable = scope.set.get(entry.variableName);
        if (!variable) {
          continue;
        }

        const access =
          entry.real.type === "Identifier" && !entry.computed
            ? `.${entry.real.name}`
            : `[${sourceCode.getText(entry.real)}]`;

        for (const reference of variable.references) {
          if (reference.isReadOnly()) {
            yield fixer.replaceText(reference.identifier, `${propsName}${access}`);
          }
        }
      }
    }

    return {
      FunctionDeclaration: onFunctionEnter,
      FunctionExpression: onFunctionEnter,
      ArrowFunctionExpression: onFunctionEnter,
      "FunctionDeclaration:exit": onFunctionExit,
      "FunctionExpression:exit": onFunctionExit,
      "ArrowFunctionExpression:exit": onFunctionExit,
      JSXElement() {
        if (functionStack.length > 0) {
          currentFunction().hasJSX = true;
        }
      },
      JSXFragment() {
        if (functionStack.length > 0) {
          currentFunction().hasJSX = true;
        }
      },
    };
  },
});

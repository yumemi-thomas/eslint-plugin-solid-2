import { ASTUtils, TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import { isFunctionNode, type FunctionNode } from "../utils.js";
import { createRule } from "./create-rule.js";
import { getSolidImportFixes, isComponent, isNameTaken } from "./solid-rule-utils.js";

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

function getAvailableName(sourceCode: TSESLint.SourceCode, preferred: string): string {
  if (!isNameTaken(sourceCode, preferred)) {
    return preferred;
  }

  let index = 2;
  while (isNameTaken(sourceCode, `${preferred}${index}`)) {
    index += 1;
  }
  return `${preferred}${index}`;
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

type Options = [{ typescriptEnabled?: boolean }?];
type MessageIds = "noDestructure";

export default createRule<Options, MessageIds>({
  name: "no-destructure",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow destructuring component props. In Solid 2, destructuring props triggers top-level untracked reads.",
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          // Opt in to type-aware analysis: also detect components used as `<C/>` in other files.
          // Requires ESLint type information and is slower; off by default.
          typescriptEnabled: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noDestructure:
        "Destructuring component props breaks Solid 2 reactivity; keep the `props` object and read properties from it.",
    },
  },
  defaultOptions: [{}],
  create(context) {
    const sourceCode = context.sourceCode;

    const onFunctionExit = (node: FunctionNode) => {
      // The component index is complete (built from the whole file), so detect and report inline.
      const props = node.params[0];
      if (
        node.params.length === 1 &&
        props?.type === "ObjectPattern" &&
        node.parent?.type !== "JSXExpressionContainer" &&
        isComponent(node, context)
      ) {
        context.report({
          node: props,
          messageId: "noDestructure",
          fix: (fixer) => fixDestructure(node, props, fixer),
        });
      }
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

      // Nested binding patterns cannot be rewritten as simple `props.x` references. Replacing the
      // parameter while leaving their bindings behind would emit undefined identifiers, so keep
      // the diagnostic but make it report-only for every shape the fixer cannot fully represent.
      const ordinaryPropertyCount = properties.filter(
        (property): property is T.Property => property.type === "Property",
      ).length;
      if (
        propEntries.length !== ordinaryPropertyCount ||
        (rest != null && rest.argument.type !== "Identifier")
      ) {
        return;
      }

      const hasDefaults = propEntries.some((entry) => entry.init);
      const propsName = getAvailableName(sourceCode, "props");
      const originalPropsName = hasDefaults ? getAvailableName(sourceCode, "_props") : propsName;

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

      // The rewrite may reference `merge`/`omit`; add the solid-js import when it isn't already
      // there so the fixed code compiles (resolveHelper has already ruled out name conflicts).
      // Emitted only after every bail-out above, so an import is never added without the rewrite.
      const missingHelpers: string[] = [];
      if (hasDefaults && !helperNames.has("merge")) {
        missingHelpers.push("merge");
      }
      if (rest && !helperNames.has("omit")) {
        missingHelpers.push("omit");
      }
      if (missingHelpers.length > 0) {
        const importFixes = getSolidImportFixes(context, fixer, missingHelpers);
        if (importFixes == null) {
          return;
        }
        yield* importFixes;
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
      "FunctionDeclaration:exit": onFunctionExit,
      "FunctionExpression:exit": onFunctionExit,
      "ArrowFunctionExpression:exit": onFunctionExit,
      VariableDeclarator(node) {
        // Body-level destructure (`const { a } = props`). Flag only when the destructured value is
        // the first parameter (the props object) of a confirmed component — never an arbitrary
        // local object. The enclosing function is already in scope, so this resolves inline.
        // Report-only (no autofix).
        if (node.id.type !== "ObjectPattern" || node.init?.type !== "Identifier") {
          return;
        }

        const variable = ASTUtils.findVariable(sourceCode.getScope(node.init), node.init);
        const def = variable?.defs[0];
        if (def?.type !== "Parameter" || !isFunctionNode(def.node)) {
          return;
        }
        // The props param may carry a default (`(props = {}) => …`), so unwrap an AssignmentPattern
        // before checking it is the first parameter.
        const firstParam = def.node.params[0];
        const firstParamId =
          firstParam?.type === "AssignmentPattern" ? firstParam.left : firstParam;
        if (firstParamId === def.name && isComponent(def.node, context)) {
          context.report({ node: node.id, messageId: "noDestructure" });
        }
      },
    };
  },
});

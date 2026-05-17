Object.defineProperties(exports, {
	__esModule: { value: true },
	[Symbol.toStringTag]: { value: "Module" }
});
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let _typescript_eslint_utils = require("@typescript-eslint/utils");
let is_html = require("is-html");
is_html = __toESM(is_html, 1);
let kebab_case = require("kebab-case");
kebab_case = __toESM(kebab_case, 1);
let known_css_properties = require("known-css-properties");
let style_to_object = require("style-to-object");
style_to_object = __toESM(style_to_object, 1);
//#region src/utils.ts
const domElementRegex = /^[a-z]/;
const isDOMElementName = (name) => domElementRegex.test(name);
const getFunctionName$1 = (node) => {
	if ((node.type === "FunctionDeclaration" || node.type === "FunctionExpression") && node.id != null) return node.id.name;
	if (node.parent?.type === "VariableDeclarator" && node.parent.id.type === "Identifier") return node.parent.id.name;
	return null;
};
const isFunctionNode$1 = (node) => node?.type === "FunctionDeclaration" || node?.type === "FunctionExpression" || node?.type === "ArrowFunctionExpression";
const isJSXElementOrFragment = (node) => node?.type === "JSXElement" || node?.type === "JSXFragment";
const trace = (node, context) => {
	if (node.type !== "Identifier") return node;
	const variable = _typescript_eslint_utils.ASTUtils.findVariable(context.sourceCode.getScope(node), node);
	const def = variable?.defs[0];
	if (!variable || !def) return node;
	switch (def.type) {
		case "FunctionName":
		case "ClassName":
		case "ImportBinding": return def.node;
		case "Variable": {
			const declaration = def.node.parent;
			if (declaration?.type === "VariableDeclaration" && declaration.kind === "const" && def.node.id.type === "Identifier" && def.node.init) return trace(def.node.init, context);
			return node;
		}
		default: return node;
	}
};
const getCommentBefore = (node, sourceCode) => sourceCode.getCommentsBefore(node).find((comment) => comment.loc.end.line >= node.loc.start.line - 1);
function appendImports(fixer, sourceCode, importNode, specifiers) {
	const text = specifiers.join(", ");
	const lastNamed = [...importNode.specifiers].reverse().find((specifier) => specifier.type === "ImportSpecifier");
	if (lastNamed) return fixer.insertTextAfter(lastNamed, `, ${text}`);
	const namespaceOrDefault = importNode.specifiers.find((specifier) => specifier.type === "ImportDefaultSpecifier" || specifier.type === "ImportNamespaceSpecifier");
	if (namespaceOrDefault) return fixer.insertTextAfter(namespaceOrDefault, `, { ${text} }`);
	const [importToken, maybeBrace] = sourceCode.getFirstTokens(importNode, { count: 2 });
	if (maybeBrace?.value === "{") return fixer.insertTextAfter(maybeBrace, ` ${text} `);
	return importToken ? fixer.insertTextAfter(importToken, ` { ${text} } from`) : null;
}
function insertImports(fixer, sourceCode, source, specifiers, aboveImport, isType = false) {
	const firstImport = aboveImport ?? sourceCode.ast.body.find((node) => node.type === "ImportDeclaration");
	const importText = `import ${isType ? "type " : ""}{ ${specifiers.join(", ")} } from "${source}";\n`;
	if (firstImport) return fixer.insertTextBeforeRange((getCommentBefore(firstImport, sourceCode) ?? firstImport).range, importText);
	return fixer.insertTextBeforeRange([0, 0], importText);
}
function jsxPropName(prop) {
	if (prop.name.type === "JSXNamespacedName") return `${prop.name.namespace.name}:${prop.name.name.name}`;
	return prop.name.name;
}
function* jsxGetAllProps(props) {
	for (const attr of props) {
		if (attr.type === "JSXSpreadAttribute" && attr.argument.type === "ObjectExpression") {
			for (const property of attr.argument.properties) if (property.type === "Property") {
				if (property.key.type === "Identifier") yield [property.key.name, property.key];
				else if (property.key.type === "Literal") yield [String(property.key.value), property.key];
			}
			continue;
		}
		if (attr.type === "JSXAttribute") yield [jsxPropName(attr), attr.name];
	}
}
const formatList = (strings) => {
	if (strings.length === 0) return "";
	if (strings.length === 1) return `'${strings[0]}'`;
	if (strings.length === 2) return `'${strings[0]}' and '${strings[1]}'`;
	const last = strings.length - 1;
	return `${strings.slice(0, last).map((value) => `'${value}'`).join(", ")}, and '${strings[last]}'`;
};
const markVariableAsUsed = (context, name, node) => context.sourceCode.markVariableAsUsed(name, node);
//#endregion
//#region src/rules/components-return-once.ts
const createRule$22 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const isNothing = (node) => {
	if (!node) return true;
	switch (node.type) {
		case "Literal": return [
			null,
			void 0,
			false,
			""
		].includes(node.value);
		case "JSXFragment": return node.children.every((child) => isNothing(child));
		default: return false;
	}
};
const getLineLength = (loc) => loc == null ? 0 : loc.end.line - loc.start.line + 1;
var components_return_once_default = createRule$22({
	meta: {
		type: "problem",
		docs: { description: "Disallow early returns in components. Solid components only run once, so conditionals should stay inside JSX." },
		fixable: "code",
		schema: [],
		messages: {
			noConditionalReturn: "Solid components run once, so a conditional return breaks reactivity. Move the condition inside JSX, such as a fragment or `<Show />`.",
			noEarlyReturn: "Solid components run once, so an early return breaks reactivity. Move the condition inside JSX, such as a fragment or `<Show />`."
		}
	},
	defaultOptions: [],
	create(context) {
		const functionStack = [];
		const sourceCode = context.sourceCode;
		const putIntoJSX = (node) => {
			const text = sourceCode.getText(node);
			return node.type === "JSXElement" || node.type === "JSXFragment" ? text : `{${text}}`;
		};
		const currentFunction = () => functionStack[functionStack.length - 1];
		const onFunctionEnter = (node) => {
			let lastReturn;
			if (node.body.type === "BlockStatement") {
				const last = [...node.body.body].reverse().find((statement) => !statement.type.endsWith("Declaration"));
				if (last?.type === "ReturnStatement") lastReturn = last;
			}
			functionStack.push({
				isComponent: false,
				lastReturn,
				earlyReturns: []
			});
		};
		const onFunctionExit = (node) => {
			const fn = currentFunction();
			if (getFunctionName$1(node)?.match(/^[a-z]/) || node.parent?.type === "JSXExpressionContainer" || node.parent?.type === "CallExpression" && node.type !== "FunctionDeclaration" && node.parent.arguments.includes(node) && !(node.parent.callee.type === "Identifier" && node.parent.callee.name.match(/^[A-Z]/))) fn.isComponent = false;
			if (fn.isComponent) {
				for (const earlyReturn of fn.earlyReturns) context.report({
					node: earlyReturn,
					messageId: "noEarlyReturn"
				});
				const argument = fn.lastReturn?.argument;
				if (argument?.type === "ConditionalExpression") context.report({
					node: argument.parent ?? argument,
					messageId: "noConditionalReturn",
					fix: (fixer) => {
						const conditions = [{
							test: argument.test,
							consequent: argument.consequent
						}];
						let fallback = argument.alternate;
						while (fallback.type === "ConditionalExpression") {
							conditions.push({
								test: fallback.test,
								consequent: fallback.consequent
							});
							fallback = fallback.alternate;
						}
						if (conditions.length >= 2) {
							const fallbackText = !isNothing(fallback) ? ` fallback={${sourceCode.getText(fallback)}}` : "";
							return fixer.replaceText(argument, `<Switch${fallbackText}>\n${conditions.map(({ test, consequent }) => `<Match when={${sourceCode.getText(test)}}>${putIntoJSX(consequent)}</Match>`).join("\n")}\n</Switch>`);
						}
						if (isNothing(argument.consequent)) return fixer.replaceText(argument, `<Show when={!(${sourceCode.getText(argument.test)})}>${putIntoJSX(argument.alternate)}</Show>`);
						if (isNothing(fallback) || getLineLength(argument.consequent.loc) >= getLineLength(fallback.loc) * 1.5) {
							const fallbackText = !isNothing(fallback) ? ` fallback={${sourceCode.getText(fallback)}}` : "";
							return fixer.replaceText(argument, `<Show when={${sourceCode.getText(argument.test)}}${fallbackText}>${putIntoJSX(argument.consequent)}</Show>`);
						}
						return fixer.replaceText(argument, `<>${putIntoJSX(argument)}</>`);
					}
				});
				else if (argument?.type === "LogicalExpression") if (argument.operator === "&&") context.report({
					node: argument,
					messageId: "noConditionalReturn"
				});
				else context.report({
					node: argument,
					messageId: "noConditionalReturn"
				});
			}
			functionStack.pop();
		};
		return {
			FunctionDeclaration: onFunctionEnter,
			FunctionExpression: onFunctionEnter,
			ArrowFunctionExpression: onFunctionEnter,
			"FunctionDeclaration:exit": onFunctionExit,
			"FunctionExpression:exit": onFunctionExit,
			"ArrowFunctionExpression:exit": onFunctionExit,
			JSXElement() {
				if (functionStack.length > 0) currentFunction().isComponent = true;
			},
			JSXFragment() {
				if (functionStack.length > 0) currentFunction().isComponent = true;
			},
			ReturnStatement(node) {
				if (functionStack.length > 0 && node !== currentFunction().lastReturn) currentFunction().earlyReturns.push(node);
			}
		};
	}
});
//#endregion
//#region src/rules/jsx-no-duplicate-props.ts
const createRule$21 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
var jsx_no_duplicate_props_default = createRule$21({
	meta: {
		type: "problem",
		docs: { description: "Disallow passing the same prop twice in JSX." },
		schema: [{
			type: "object",
			properties: { ignoreCase: { type: "boolean" } },
			additionalProperties: false
		}],
		messages: {
			noDuplicateChildren: "Using {{used}} at the same time is not allowed.",
			noDuplicateClass: "Duplicate `class` props are not allowed. Compose classes in a single `class` value instead.",
			noDuplicateProps: "Duplicate props are not allowed."
		}
	},
	defaultOptions: [],
	create(context) {
		return { JSXOpeningElement(node) {
			const ignoreCase = context.options[0]?.ignoreCase ?? false;
			const props = /* @__PURE__ */ new Set();
			const normalize = (name) => {
				let normalized = ignoreCase ? name.toLowerCase() : name;
				normalized = normalized.replace(/^(?:attr|prop):/i, "");
				if (/^on(?:capture)?:/i.test(normalized)) return normalized.toLowerCase();
				if (/^on[a-zA-Z]/.test(normalized)) return normalized.toLowerCase();
				return normalized;
			};
			for (const [name, propNode] of jsxGetAllProps(node.attributes)) {
				const normalized = normalize(name);
				if (props.has(normalized)) context.report({
					node: propNode,
					messageId: normalized === "class" ? "noDuplicateClass" : "noDuplicateProps"
				});
				props.add(normalized);
			}
			const hasChildrenProp = props.has("children");
			const hasChildren = node.parent.children.length > 0;
			const hasInnerHTML = props.has("innerHTML") || props.has("innerhtml");
			const hasTextContent = props.has("textContent") || props.has("textcontent");
			const used = [
				hasChildrenProp && "`props.children`",
				hasChildren && "JSX children",
				hasInnerHTML && "`props.innerHTML`",
				hasTextContent && "`props.textContent`"
			].filter(Boolean);
			if (used.length > 1) context.report({
				node,
				messageId: "noDuplicateChildren",
				data: { used: used.join(", ") }
			});
		} };
	}
});
//#endregion
//#region src/rules/jsx-no-script-url.ts
const createRule$20 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const JAVASCRIPT_PROTOCOL = "javascript:";
function isLeadingProtocolPadding(char) {
	return char.charCodeAt(0) <= 31 || char === " ";
}
function isEmbeddedProtocolPadding(char) {
	return char === "\r" || char === "\n" || char === "	";
}
function isJavaScriptProtocol(value) {
	let index = 0;
	while (index < value.length && isLeadingProtocolPadding(value[index])) index += 1;
	for (const expected of JAVASCRIPT_PROTOCOL) {
		while (index < value.length && isEmbeddedProtocolPadding(value[index])) index += 1;
		if (value[index]?.toLowerCase() !== expected) return false;
		index += 1;
	}
	return true;
}
var jsx_no_script_url_default = createRule$20({
	meta: {
		type: "problem",
		docs: { description: "Disallow javascript: URLs." },
		schema: [],
		messages: { noJSURL: "For security, don't use javascript: URLs. Use event handlers instead if you can." }
	},
	defaultOptions: [],
	create(context) {
		return { JSXAttribute(node) {
			if (node.name.type !== "JSXIdentifier" || node.value == null) return;
			const rawValue = node.value.type === "JSXExpressionContainer" ? node.value.expression : node.value;
			const link = _typescript_eslint_utils.ASTUtils.getStaticValue(rawValue, context.sourceCode.getScope(node));
			if (typeof link?.value === "string" && isJavaScriptProtocol(link.value)) context.report({
				node: node.value,
				messageId: "noJSURL"
			});
		} };
	}
});
//#endregion
//#region src/rules/jsx-no-undef.ts
const createRule$19 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const AUTO_COMPONENTS = [
	"For",
	"Show",
	"Switch",
	"Match",
	"Loading",
	"Errored",
	"Reveal",
	"Repeat"
];
const SOURCE_MODULE = "solid-js";
var jsx_no_undef_default = createRule$19({
	meta: {
		type: "problem",
		docs: { description: "Disallow references to undefined variables in JSX." },
		fixable: "code",
		schema: [{
			type: "object",
			properties: {
				allowGlobals: { type: "boolean" },
				autoImport: { type: "boolean" },
				typescriptEnabled: { type: "boolean" }
			},
			additionalProperties: false
		}],
		messages: {
			autoImport: "{{imports}} should be imported from '{{source}}'.",
			undefined: "'{{identifier}}' is not defined."
		}
	},
	defaultOptions: [],
	create(context) {
		const allowGlobals = context.options[0]?.allowGlobals ?? false;
		const autoImport = context.options[0]?.autoImport !== false;
		const isTypeScriptEnabled = context.options[0]?.typescriptEnabled ?? false;
		const missingComponents = /* @__PURE__ */ new Set();
		const sourceCode = context.sourceCode;
		const isDefined = (node) => {
			let scope = sourceCode.getScope(node);
			const sourceType = sourceCode.ast.sourceType;
			const scopeUpperBound = !allowGlobals && sourceType === "module" ? "module" : "global";
			const variables = [...scope.variables];
			while (scope.type !== scopeUpperBound && scope.type !== "global" && scope.upper) {
				scope = scope.upper;
				variables.push(...scope.variables);
			}
			return variables.some((variable) => variable.name === node.name);
		};
		const checkIdentifier = (node, isComponent = false) => {
			if (node.name === "this" || isDefined(node)) return;
			if (isComponent && autoImport && AUTO_COMPONENTS.includes(node.name)) {
				missingComponents.add(node.name);
				return;
			}
			if (!isTypeScriptEnabled) context.report({
				node,
				messageId: "undefined",
				data: { identifier: node.name }
			});
		};
		return {
			JSXOpeningElement(node) {
				switch (node.name.type) {
					case "JSXIdentifier":
						if (!isDOMElementName(node.name.name)) checkIdentifier(node.name, true);
						break;
					case "JSXMemberExpression": {
						let current = node.name.object;
						while (current.type === "JSXMemberExpression") current = current.object;
						if (current.type === "JSXIdentifier") checkIdentifier(current);
						break;
					}
					default: break;
				}
			},
			"Program:exit"(programNode) {
				if (!autoImport || missingComponents.size === 0) return;
				const names = [...missingComponents.values()];
				const importNode = programNode.body.find((child) => child.type === "ImportDeclaration" && child.importKind !== "type" && child.source.type === "Literal" && child.source.value === SOURCE_MODULE);
				const reportNode = importNode ?? programNode;
				context.report({
					node: reportNode,
					messageId: "autoImport",
					data: {
						imports: formatList(names),
						source: SOURCE_MODULE
					},
					fix: (fixer) => importNode ? appendImports(fixer, sourceCode, importNode, names) : insertImports(fixer, sourceCode, SOURCE_MODULE, names)
				});
			}
		};
	}
});
//#endregion
//#region src/rules/jsx-uses-vars.ts
const createRule$18 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
var jsx_uses_vars_default = createRule$18({
	meta: {
		type: "problem",
		docs: { description: "Prevent variables used in JSX from being marked as unused." },
		schema: [],
		messages: {}
	},
	defaultOptions: [],
	create(context) {
		return { JSXOpeningElement(node) {
			switch (node.name.type) {
				case "JSXNamespacedName": return;
				case "JSXIdentifier":
					markVariableAsUsed(context, node.name.name, node.name);
					return;
				case "JSXMemberExpression": {
					let parent = node.name.object;
					while (parent.type === "JSXMemberExpression") parent = parent.object;
					if (parent.type === "JSXIdentifier") markVariableAsUsed(context, parent.name, parent);
				}
			}
		} };
	}
});
//#endregion
//#region src/rules/no-array-handlers.ts
const createRule$17 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
var no_array_handlers_default = createRule$17({
	meta: {
		type: "problem",
		docs: { description: "Disallow usage of type-unsafe event handlers." },
		schema: [],
		messages: { noArrayHandlers: "Passing an array as an event handler is potentially type-unsafe." }
	},
	defaultOptions: [],
	create(context) {
		const resolveValue = (node) => {
			const traced = trace(node, context);
			if (traced.type !== "Identifier") return traced;
			const definition = _typescript_eslint_utils.ASTUtils.findVariable(context.sourceCode.getScope(traced), traced)?.defs[0];
			if (definition?.type === "Variable" && definition.node.parent?.type === "VariableDeclaration" && definition.node.parent.kind === "const" && definition.node.id.type === "Identifier" && definition.node.init != null) return trace(definition.node.init, context);
			return traced;
		};
		return { JSXAttribute(node) {
			const openingElement = node.parent;
			if (openingElement.name.type !== "JSXIdentifier" || !isDOMElementName(openingElement.name.name)) return;
			const isNamespacedHandler = node.name.type === "JSXNamespacedName" && node.name.namespace.name === "on";
			const isNormalEventHandler = node.name.type === "JSXIdentifier" && /^on[a-zA-Z]/.test(node.name.name);
			if ((isNamespacedHandler || isNormalEventHandler) && node.value?.type === "JSXExpressionContainer" && node.value.expression.type !== "JSXEmptyExpression" && resolveValue(node.value.expression).type === "ArrayExpression") context.report({
				node,
				messageId: "noArrayHandlers"
			});
		} };
	}
});
//#endregion
//#region src/rules/solid-rule-utils.ts
function collectSolidAliases(node, canonicalNames, aliases) {
	if (node.source.type !== "Literal" || node.source.value !== "solid-js") return;
	for (const specifier of node.specifiers) {
		if (specifier.type !== "ImportSpecifier") continue;
		const importedName = specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value;
		if (canonicalNames.has(importedName)) aliases.add(specifier.local.name);
	}
}
function matchesSolidName(name, aliases, canonicalNames) {
	return aliases.has(name) || canonicalNames.has(name);
}
function isCallbackArgumentOf(node, argumentIndex, aliases, canonicalNames) {
	return node.parent?.type === "CallExpression" && node.parent.arguments[argumentIndex] === node && node.parent.callee.type === "Identifier" && matchesSolidName(node.parent.callee.name, aliases, canonicalNames);
}
function getReturnedExpressions(node) {
	if (node.type === "ArrowFunctionExpression" && node.body.type !== "BlockStatement") return [node.body];
	if (node.body.type !== "BlockStatement") return [];
	const returned = [];
	const statements = [...node.body.body];
	while (statements.length > 0) {
		const statement = statements.pop();
		switch (statement.type) {
			case "BlockStatement":
				statements.push(...statement.body);
				break;
			case "DoWhileStatement":
			case "ForInStatement":
			case "ForOfStatement":
			case "ForStatement":
			case "WhileStatement":
			case "LabeledStatement":
			case "WithStatement":
				statements.push(statement.body);
				break;
			case "IfStatement":
				statements.push(statement.consequent);
				if (statement.alternate) statements.push(statement.alternate);
				break;
			case "SwitchStatement":
				for (const switchCase of statement.cases) statements.push(...switchCase.consequent);
				break;
			case "TryStatement":
				statements.push(statement.block);
				if (statement.handler) statements.push(statement.handler.body);
				if (statement.finalizer) statements.push(statement.finalizer);
				break;
			case "ReturnStatement":
				returned.push(statement.argument ?? null);
				break;
			default: break;
		}
	}
	return returned;
}
function getPropertyName$2(node) {
	if (!node.computed && node.key.type === "Identifier") return node.key.name;
	if (node.key.type === "Literal" && typeof node.key.value === "string") return node.key.value;
	return null;
}
function getNearestFunctionAncestor$1(node) {
	let current = node.parent;
	while (current != null) {
		if (isFunctionNode$1(current)) return current;
		current = current.parent;
	}
	return null;
}
function resolveSolidCallee(node, context, aliases, canonicalNames) {
	if (node.type !== "Identifier") return null;
	if (matchesSolidName(node.name, aliases, canonicalNames)) return node.name;
	const traced = trace(node, context);
	if (traced.type === "Identifier" && canonicalNames.has(traced.name)) return traced.name;
	if (traced.type === "ImportSpecifier" && traced.parent?.type === "ImportDeclaration" && traced.parent.source.type === "Literal" && traced.parent.source.value === "solid-js") {
		const importedName = traced.imported.type === "Identifier" ? traced.imported.name : traced.imported.value;
		if (canonicalNames.has(importedName)) return importedName;
	}
	return null;
}
//#endregion
//#region src/rules/no-cleanup-in-forbidden-scope.ts
const createRule$16 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const FORBIDDEN_SCOPE_NAMES$2 = new Set(["createTrackedEffect", "onSettled"]);
const ON_CLEANUP_NAMES = new Set(["onCleanup"]);
var no_cleanup_in_forbidden_scope_default = createRule$16({
	meta: {
		type: "problem",
		docs: { description: "Disallow onCleanup inside createTrackedEffect and onSettled in Solid 2." },
		schema: [],
		messages: { noCleanupInForbiddenScope: "Cannot use `onCleanup` inside `createTrackedEffect` or `onSettled`; return a cleanup function instead." }
	},
	defaultOptions: [],
	create(context) {
		const onCleanupAliases = /* @__PURE__ */ new Set();
		const forbiddenScopeAliases = /* @__PURE__ */ new Set();
		const forbiddenStack = [];
		const onFunctionEnter = (node) => {
			if ((node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") && isCallbackArgumentOf(node, 0, forbiddenScopeAliases, FORBIDDEN_SCOPE_NAMES$2)) forbiddenStack.push(node);
		};
		const onFunctionExit = (node) => {
			if (forbiddenStack[forbiddenStack.length - 1] === node) forbiddenStack.pop();
		};
		return {
			ImportDeclaration(node) {
				collectSolidAliases(node, ON_CLEANUP_NAMES, onCleanupAliases);
				collectSolidAliases(node, FORBIDDEN_SCOPE_NAMES$2, forbiddenScopeAliases);
			},
			FunctionDeclaration: onFunctionEnter,
			FunctionExpression: onFunctionEnter,
			ArrowFunctionExpression: onFunctionEnter,
			"FunctionDeclaration:exit": onFunctionExit,
			"FunctionExpression:exit": onFunctionExit,
			"ArrowFunctionExpression:exit": onFunctionExit,
			CallExpression(node) {
				const currentForbidden = forbiddenStack[forbiddenStack.length - 1];
				if (currentForbidden && getNearestFunctionAncestor$1(node) === currentForbidden && node.callee.type === "Identifier" && (onCleanupAliases.has(node.callee.name) || ON_CLEANUP_NAMES.has(node.callee.name))) context.report({
					node: node.callee,
					messageId: "noCleanupInForbiddenScope"
				});
			}
		};
	}
});
//#endregion
//#region src/rules/no-destructure.ts
const createRule$15 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const getName = (node) => {
	switch (node.type) {
		case "Literal": return typeof node.value === "string" ? node.value : null;
		case "Identifier": return node.name;
		case "AssignmentPattern": return getName(node.left);
		default: return _typescript_eslint_utils.ASTUtils.getStringIfConstant(node);
	}
};
function isNameTaken(sourceCode, name) {
	return sourceCode.scopeManager?.scopes.some((scope) => scope.set.has(name)) ?? false;
}
const getPropertyInfo = (property) => {
	const variableName = getName(property.value);
	if (variableName === null) return null;
	return {
		init: property.value.type === "AssignmentPattern" ? property.value.right : void 0,
		computed: property.computed,
		real: property.key,
		variableName
	};
};
var no_destructure_default = createRule$15({
	meta: {
		type: "problem",
		docs: { description: "Disallow destructuring component props. In Solid 2, destructuring props triggers top-level untracked reads." },
		fixable: "code",
		schema: [],
		messages: { noDestructure: "Destructuring component props breaks Solid 2 reactivity; keep the `props` object and read properties from it." }
	},
	defaultOptions: [],
	create(context) {
		const functionStack = [];
		const currentFunction = () => functionStack[functionStack.length - 1];
		const onFunctionEnter = () => {
			functionStack.push({ hasJSX: false });
		};
		const onFunctionExit = (node) => {
			const props = node.params[0];
			if (node.params.length === 1 && props?.type === "ObjectPattern" && currentFunction()?.hasJSX && node.parent?.type !== "JSXExpressionContainer") context.report({
				node: props,
				messageId: "noDestructure",
				fix: (fixer) => fixDestructure(node, props, fixer)
			});
			functionStack.pop();
		};
		function* fixDestructure(func, props, fixer) {
			const sourceCode = context.sourceCode;
			const importNode = sourceCode.ast.body.find((node) => node.type === "ImportDeclaration" && node.importKind !== "type" && node.source.type === "Literal" && node.source.value === "solid-js");
			const properties = props.properties;
			const propEntries = [];
			let rest = null;
			for (const property of properties) {
				if (property.type === "RestElement") {
					rest = property;
					continue;
				}
				const info = getPropertyInfo(property);
				if (info) propEntries.push(info);
			}
			const hasDefaults = propEntries.some((entry) => entry.init);
			const propsName = "props";
			const originalPropsName = hasDefaults ? "_props" : propsName;
			const helperNames = /* @__PURE__ */ new Map();
			if (importNode) for (const specifier of importNode.specifiers) {
				if (specifier.type !== "ImportSpecifier") continue;
				const importedName = specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value;
				if (importedName === "merge" || importedName === "omit") helperNames.set(importedName, specifier.local.name);
			}
			const resolveHelper = (importedName) => {
				const existing = helperNames.get(importedName);
				if (existing) return existing;
				return isNameTaken(sourceCode, importedName) ? null : importedName;
			};
			const mergeName = hasDefaults ? resolveHelper("merge") : null;
			const omitName = rest ? resolveHelper("omit") : null;
			const defaultPairs = propEntries.filter((entry) => entry.init).map((entry) => {
				return `${entry.computed ? `[${sourceCode.getText(entry.real)}]` : sourceCode.getText(entry.real)}: ${sourceCode.getText(entry.init)}`;
			});
			const omittedKeys = propEntries.map((entry) => entry.real.type === "Identifier" ? JSON.stringify(entry.real.name) : sourceCode.getText(entry.real));
			const setupLines = [];
			if (hasDefaults && mergeName == null || rest && omitName == null) return;
			if (hasDefaults) setupLines.push(`const ${propsName} = ${mergeName}({ ${defaultPairs.join(", ")} }, ${originalPropsName});`);
			if (rest) {
				const restName = rest.argument.type === "Identifier" ? rest.argument.name : "rest";
				const omitArgs = omittedKeys.length > 0 ? `, ${omittedKeys.join(", ")}` : "";
				setupLines.push(`const ${restName} = ${omitName}(${propsName}${omitArgs});`);
			}
			if (setupLines.length > 0 && func.body.type !== "BlockStatement") return;
			if (props.typeAnnotation) yield fixer.replaceTextRange([props.range[0], props.typeAnnotation.range[0]], originalPropsName);
			else yield fixer.replaceText(props, originalPropsName);
			if (setupLines.length > 0) {
				if (func.body.type === "BlockStatement") {
					const indent = " ".repeat(func.body.body[0]?.loc?.start.column ?? 2);
					if (func.body.body.length > 0) yield fixer.insertTextBefore(func.body.body[0], `${setupLines.join(`\n${indent}`)}\n${indent}`);
					else yield fixer.insertTextAfterRange([func.body.range[0], func.body.range[0] + 1], `\n${indent}${setupLines.join(`\n${indent}`)}\n`);
				}
			}
			const scope = sourceCode.scopeManager?.acquire(func);
			if (!scope) return;
			for (const entry of propEntries) {
				const variable = scope.set.get(entry.variableName);
				if (!variable) continue;
				const access = entry.real.type === "Identifier" && !entry.computed ? `.${entry.real.name}` : `[${sourceCode.getText(entry.real)}]`;
				for (const reference of variable.references) if (reference.isReadOnly()) yield fixer.replaceText(reference.identifier, `${propsName}${access}`);
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
				if (functionStack.length > 0) currentFunction().hasJSX = true;
			},
			JSXFragment() {
				if (functionStack.length > 0) currentFunction().hasJSX = true;
			}
		};
	}
});
//#endregion
//#region src/rules/no-flush-in-forbidden-scope.ts
const createRule$14 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const FORBIDDEN_SCOPE_NAMES$1 = new Set(["createTrackedEffect", "onSettled"]);
const FLUSH_NAMES = new Set(["flush"]);
var no_flush_in_forbidden_scope_default = createRule$14({
	meta: {
		type: "problem",
		docs: { description: "Disallow flush() inside createTrackedEffect and onSettled in Solid 2." },
		schema: [],
		messages: { noFlushInForbiddenScope: "Cannot call `flush()` from inside `createTrackedEffect` or `onSettled`; schedule work outside instead." }
	},
	defaultOptions: [],
	create(context) {
		const forbiddenScopeAliases = /* @__PURE__ */ new Set();
		const flushAliases = /* @__PURE__ */ new Set();
		const forbiddenStack = [];
		const onFunctionEnter = (node) => {
			if ((node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") && isCallbackArgumentOf(node, 0, forbiddenScopeAliases, FORBIDDEN_SCOPE_NAMES$1)) forbiddenStack.push(node);
		};
		const onFunctionExit = (node) => {
			if (forbiddenStack[forbiddenStack.length - 1] === node) forbiddenStack.pop();
		};
		return {
			ImportDeclaration(node) {
				collectSolidAliases(node, FORBIDDEN_SCOPE_NAMES$1, forbiddenScopeAliases);
				collectSolidAliases(node, FLUSH_NAMES, flushAliases);
			},
			FunctionDeclaration: onFunctionEnter,
			FunctionExpression: onFunctionEnter,
			ArrowFunctionExpression: onFunctionEnter,
			"FunctionDeclaration:exit": onFunctionExit,
			"FunctionExpression:exit": onFunctionExit,
			"ArrowFunctionExpression:exit": onFunctionExit,
			CallExpression(node) {
				const currentForbidden = forbiddenStack[forbiddenStack.length - 1];
				if (currentForbidden && getNearestFunctionAncestor$1(node) === currentForbidden && node.callee.type === "Identifier" && matchesSolidName(node.callee.name, flushAliases, FLUSH_NAMES)) context.report({
					node: node.callee,
					messageId: "noFlushInForbiddenScope"
				});
			}
		};
	}
});
//#endregion
//#region src/rules/no-invalid-cleanup-return.ts
const createRule$13 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const APPLY_SCOPE_NAMES = new Set(["createEffect", "createRenderEffect"]);
const CLEANUP_SCOPE_NAMES = new Set(["createTrackedEffect", "onSettled"]);
function isDefinitelyInvalidCleanupReturn(node) {
	if (node == null) return false;
	switch (node.type) {
		case "ArrowFunctionExpression":
		case "FunctionExpression": return false;
		case "Identifier": return false;
		case "ConditionalExpression": return isDefinitelyInvalidCleanupReturn(node.consequent) || isDefinitelyInvalidCleanupReturn(node.alternate);
		case "Literal": return node.value !== void 0;
		case "ObjectExpression":
		case "ArrayExpression":
		case "TemplateLiteral":
		case "BinaryExpression":
		case "UnaryExpression":
		case "UpdateExpression":
		case "NewExpression":
		case "JSXElement":
		case "JSXFragment": return true;
		default: return false;
	}
}
var no_invalid_cleanup_return_default = createRule$13({
	meta: {
		type: "problem",
		docs: { description: "Disallow obviously invalid cleanup return values from Solid 2 effect/onSettled callbacks." },
		schema: [],
		messages: { noInvalidCleanupReturn: "{{name}} callback must return a cleanup function or `undefined` in Solid 2." }
	},
	defaultOptions: [],
	create(context) {
		const applyAliases = /* @__PURE__ */ new Set();
		const cleanupAliases = /* @__PURE__ */ new Set();
		const getFunctionValue = (value) => {
			if (value == null || value.type === "SpreadElement") return null;
			if (value.type === "FunctionExpression" || value.type === "ArrowFunctionExpression") return value;
			const traced = trace(value, context);
			return traced.type === "FunctionExpression" || traced.type === "ArrowFunctionExpression" ? traced : null;
		};
		const getApplyCallbacks = (value) => {
			const direct = getFunctionValue(value);
			if (direct) return [direct];
			if (value?.type !== "ObjectExpression") return [];
			return value.properties.flatMap((property) => {
				if (property.type !== "Property" || getPropertyName$2(property) !== "effect") return [];
				const effect = getFunctionValue(property.value);
				return effect ? [effect] : [];
			});
		};
		const check = (node, name) => {
			for (const returned of getReturnedExpressions(node)) {
				if (!isDefinitelyInvalidCleanupReturn(returned)) continue;
				context.report({
					node: returned ?? node,
					messageId: "noInvalidCleanupReturn",
					data: { name }
				});
			}
		};
		return {
			ImportDeclaration(node) {
				collectSolidAliases(node, APPLY_SCOPE_NAMES, applyAliases);
				collectSolidAliases(node, CLEANUP_SCOPE_NAMES, cleanupAliases);
			},
			CallExpression(node) {
				if (node.callee.type !== "Identifier") return;
				if (matchesSolidName(node.callee.name, applyAliases, APPLY_SCOPE_NAMES)) {
					for (const callback of getApplyCallbacks(node.arguments[1])) check(callback, node.callee.name);
					return;
				}
				if (matchesSolidName(node.callee.name, cleanupAliases, CLEANUP_SCOPE_NAMES)) {
					const callback = getFunctionValue(node.arguments[0]);
					if (callback) check(callback, node.callee.name);
				}
			}
		};
	}
});
//#endregion
//#region src/rules/no-innerhtml.ts
const createRule$12 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
function hasMeaningfulChildren(element) {
	return element.children.some((child) => {
		switch (child.type) {
			case "JSXText": return child.value.trim().length > 0;
			case "JSXExpressionContainer": return child.expression.type !== "JSXEmptyExpression";
			default: return true;
		}
	});
}
var no_innerhtml_default = createRule$12({
	meta: {
		type: "problem",
		docs: { description: "Disallow usage of the innerHTML attribute, which can often lead to security vulnerabilities." },
		fixable: "code",
		hasSuggestions: true,
		schema: [{
			type: "object",
			properties: { allowStatic: { type: "boolean" } },
			additionalProperties: false
		}],
		messages: {
			conflict: "The innerHTML attribute should not be used on an element with child elements; they will be overwritten.",
			dangerous: "The innerHTML attribute is dangerous; passing unsanitized input can lead to security vulnerabilities.",
			dangerouslySetInnerHTML: "The dangerouslySetInnerHTML prop is not supported; use innerHTML instead.",
			notHtml: "The string passed to innerHTML does not appear to be valid HTML.",
			useInnerText: "For text content, using innerText is clearer and safer."
		}
	},
	defaultOptions: [{ allowStatic: true }],
	create(context) {
		const allowStatic = context.options[0]?.allowStatic ?? true;
		return { JSXAttribute(node) {
			const propName = jsxPropName(node);
			if (propName === "dangerouslySetInnerHTML") {
				if (node.value?.type === "JSXExpressionContainer" && node.value.expression.type === "ObjectExpression" && node.value.expression.properties.length === 1) {
					const htmlProp = node.value.expression.properties[0];
					if (htmlProp.type === "Property" && htmlProp.key.type === "Identifier" && htmlProp.key.name === "__html") {
						context.report({
							node,
							messageId: "dangerouslySetInnerHTML",
							fix: (fixer) => {
								const propRange = node.range;
								const valueRange = htmlProp.value.range;
								return [fixer.replaceTextRange([propRange[0], valueRange[0]], "innerHTML={"), fixer.replaceTextRange([valueRange[1], propRange[1]], "}")];
							}
						});
						return;
					}
				}
				context.report({
					node,
					messageId: "dangerouslySetInnerHTML"
				});
				return;
			}
			if (propName !== "innerHTML") return;
			const innerHtmlNode = node.value?.type === "JSXExpressionContainer" ? node.value.expression : node.value;
			if (allowStatic) {
				const innerHtml = innerHtmlNode && _typescript_eslint_utils.ASTUtils.getStringIfConstant(innerHtmlNode);
				if (typeof innerHtml === "string") {
					if ((0, is_html.default)(innerHtml)) {
						if (node.parent?.parent?.type === "JSXElement" && hasMeaningfulChildren(node.parent.parent)) context.report({
							node: node.parent.parent,
							messageId: "conflict"
						});
					} else context.report({
						node,
						messageId: "notHtml",
						suggest: [{
							messageId: "useInnerText",
							fix: (fixer) => fixer.replaceText(node.name, "innerText")
						}]
					});
					return;
				}
			}
			context.report({
				node,
				messageId: "dangerous"
			});
		} };
	}
});
//#endregion
//#region src/rules/no-owned-scope-writes.ts
const createRule$11 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const SETTER_FACTORIES = new Set([
	"createOptimistic",
	"createOptimisticStore",
	"createSignal",
	"createStore"
]);
const EFFECT_FACTORIES = new Set(["createEffect", "createRenderEffect"]);
const COMPUTE_FACTORIES = new Set([
	"createEffect",
	"createMemo",
	"createRenderEffect"
]);
function expressionCanYieldJSX$1(node) {
	if (node == null) return false;
	switch (node.type) {
		case "JSXElement":
		case "JSXFragment": return true;
		case "ConditionalExpression": return expressionCanYieldJSX$1(node.consequent) || expressionCanYieldJSX$1(node.alternate);
		case "LogicalExpression": return expressionCanYieldJSX$1(node.left) || expressionCanYieldJSX$1(node.right);
		case "SequenceExpression": return expressionCanYieldJSX$1(node.expressions.at(-1));
		default: return false;
	}
}
function getPropertyName$1(node) {
	if (!node.computed && node.key.type === "Identifier") return node.key.name;
	if (node.key.type === "Literal" && typeof node.key.value === "string") return node.key.value;
	return null;
}
function hasOwnedWriteOption(node) {
	const options = node.arguments[1];
	if (options?.type !== "ObjectExpression") return false;
	return options.properties.some((property) => property.type === "Property" && getPropertyName$1(property) === "ownedWrite" && property.value.type === "Literal" && property.value.value === true);
}
function blockReturnsJSX$1(block) {
	const statements = [...block.body];
	while (statements.length > 0) {
		const statement = statements.pop();
		switch (statement.type) {
			case "BlockStatement":
				statements.push(...statement.body);
				break;
			case "IfStatement":
				if (statement.consequent) statements.push(statement.consequent);
				if (statement.alternate) statements.push(statement.alternate);
				break;
			case "LabeledStatement":
			case "WithStatement":
				statements.push(statement.body);
				break;
			case "SwitchStatement":
				for (const switchCase of statement.cases) statements.push(...switchCase.consequent);
				break;
			case "TryStatement":
				statements.push(statement.block);
				if (statement.handler) statements.push(statement.handler.body);
				if (statement.finalizer) statements.push(statement.finalizer);
				break;
			case "ReturnStatement":
				if (expressionCanYieldJSX$1(statement.argument)) return true;
				break;
			default: break;
		}
	}
	return false;
}
function returnsJSX$2(node) {
	if (node.body.type !== "BlockStatement") return expressionCanYieldJSX$1(node.body);
	return blockReturnsJSX$1(node.body);
}
function getComponentName(node) {
	if ((node.type === "FunctionDeclaration" || node.type === "FunctionExpression") && node.id != null) return node.id.name;
	if (node.parent?.type === "VariableDeclarator" && node.parent.id.type === "Identifier") return node.parent.id.name;
	return null;
}
function isComponentLike$1(node) {
	if (node.parent?.type === "JSXExpressionContainer") return false;
	const name = getComponentName(node);
	return returnsJSX$2(node) && (name == null || !/^[a-z]/.test(name));
}
function isOwnedScopeFunction(node, computeAliases, effectAliases) {
	if (isComponentLike$1(node)) return true;
	if (node.parent?.type !== "CallExpression" || node.parent.arguments[0] !== node || node.parent.callee.type !== "Identifier") return false;
	const callee = node.parent.callee.name;
	if (!computeAliases.has(callee) && !COMPUTE_FACTORIES.has(callee)) return false;
	if (EFFECT_FACTORIES.has(callee) || effectAliases.has(callee)) return node.parent.arguments.length >= 2;
	return true;
}
var no_owned_scope_writes_default = createRule$11({
	meta: {
		type: "problem",
		docs: { description: "Disallow signal/store writes inside component bodies and reactive compute scopes in Solid 2." },
		schema: [],
		messages: { noOwnedScopeWrite: "Writing to state inside a component or reactive compute scope is not allowed in Solid 2. Derive values instead, move the write to an event handler or apply phase, or use `ownedWrite: true` for internal `createSignal` state." }
	},
	defaultOptions: [],
	create(context) {
		const setterVariables = /* @__PURE__ */ new Map();
		const setterFactories = /* @__PURE__ */ new Set();
		const createSignalAliases = /* @__PURE__ */ new Set();
		const computeAliases = /* @__PURE__ */ new Set();
		const effectAliases = /* @__PURE__ */ new Set();
		const functionStack = [];
		const sourceCode = context.sourceCode;
		const currentFunction = () => functionStack[functionStack.length - 1];
		const onFunctionEnter = (node) => {
			functionStack.push({
				node,
				forbidden: isOwnedScopeFunction(node, computeAliases, effectAliases)
			});
		};
		const onFunctionExit = () => {
			functionStack.pop();
		};
		return {
			ImportDeclaration(node) {
				if (node.source.type !== "Literal" || node.source.value !== "solid-js") return;
				for (const specifier of node.specifiers) {
					if (specifier.type !== "ImportSpecifier") continue;
					const importedName = specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value;
					if (SETTER_FACTORIES.has(importedName)) setterFactories.add(specifier.local.name);
					if (importedName === "createSignal") createSignalAliases.add(specifier.local.name);
					if (COMPUTE_FACTORIES.has(importedName)) computeAliases.add(specifier.local.name);
					if (EFFECT_FACTORIES.has(importedName)) effectAliases.add(specifier.local.name);
				}
			},
			VariableDeclarator(node) {
				if (node.id.type !== "ArrayPattern" || node.init?.type !== "CallExpression" || node.init.callee.type !== "Identifier" || !setterFactories.has(node.init.callee.name) && !SETTER_FACTORIES.has(node.init.callee.name)) return;
				const setterElement = node.id.elements[1];
				if (setterElement?.type !== "Identifier") return;
				const variable = sourceCode.scopeManager?.getDeclaredVariables(node).find((declared) => declared.name === setterElement.name);
				if (!variable) return;
				setterVariables.set(variable, { allowOwnedWrite: (node.init.callee.name === "createSignal" || createSignalAliases.has(node.init.callee.name)) && hasOwnedWriteOption(node.init) });
			},
			FunctionDeclaration: onFunctionEnter,
			FunctionExpression: onFunctionEnter,
			ArrowFunctionExpression: onFunctionEnter,
			"FunctionDeclaration:exit": onFunctionExit,
			"FunctionExpression:exit": onFunctionExit,
			"ArrowFunctionExpression:exit": onFunctionExit,
			CallExpression(node) {
				if (!currentFunction()?.forbidden || node.callee.type !== "Identifier") return;
				const variable = _typescript_eslint_utils.ASTUtils.findVariable(sourceCode.getScope(node), node.callee);
				const setter = variable && setterVariables.get(variable);
				if (!setter || setter.allowOwnedWrite) return;
				context.report({
					node: node.callee,
					messageId: "noOwnedScopeWrite"
				});
			}
		};
	}
});
//#endregion
//#region src/rules/no-primitives-in-forbidden-scope.ts
const createRule$10 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const FORBIDDEN_SCOPE_NAMES = new Set(["createTrackedEffect", "onSettled"]);
const PRIMITIVE_NAMES = new Set([
	"createEffect",
	"createMemo",
	"createOptimistic",
	"createOptimisticStore",
	"createProjection",
	"createRenderEffect",
	"createSignal",
	"createStore",
	"createTrackedEffect"
]);
var no_primitives_in_forbidden_scope_default = createRule$10({
	meta: {
		type: "problem",
		docs: { description: "Disallow creating reactive primitives inside createTrackedEffect and onSettled in Solid 2." },
		schema: [],
		messages: { noPrimitivesInForbiddenScope: "Cannot create reactive primitives inside `createTrackedEffect` or `onSettled`; move them to the component body or another owner." }
	},
	defaultOptions: [],
	create(context) {
		const forbiddenScopeAliases = /* @__PURE__ */ new Set();
		const primitiveAliases = /* @__PURE__ */ new Set();
		const forbiddenStack = [];
		const onFunctionEnter = (node) => {
			if ((node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") && isCallbackArgumentOf(node, 0, forbiddenScopeAliases, FORBIDDEN_SCOPE_NAMES)) forbiddenStack.push(node);
		};
		const onFunctionExit = (node) => {
			if (forbiddenStack[forbiddenStack.length - 1] === node) forbiddenStack.pop();
		};
		return {
			ImportDeclaration(node) {
				collectSolidAliases(node, FORBIDDEN_SCOPE_NAMES, forbiddenScopeAliases);
				collectSolidAliases(node, PRIMITIVE_NAMES, primitiveAliases);
			},
			FunctionDeclaration: onFunctionEnter,
			FunctionExpression: onFunctionEnter,
			ArrowFunctionExpression: onFunctionEnter,
			"FunctionDeclaration:exit": onFunctionExit,
			"FunctionExpression:exit": onFunctionExit,
			"ArrowFunctionExpression:exit": onFunctionExit,
			CallExpression(node) {
				const currentForbidden = forbiddenStack[forbiddenStack.length - 1];
				if (currentForbidden && getNearestFunctionAncestor$1(node) === currentForbidden && node.callee.type === "Identifier" && matchesSolidName(node.callee.name, primitiveAliases, PRIMITIVE_NAMES)) context.report({
					node: node.callee,
					messageId: "noPrimitivesInForbiddenScope"
				});
			}
		};
	}
});
//#endregion
//#region src/rules/no-react-deps.ts
const createRule$9 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const MEMO_NAMES = new Set(["createMemo"]);
const EFFECT_NAMES$2 = new Set(["createEffect", "createRenderEffect"]);
function resolveSolidFactory(callee, context, aliases, canonical) {
	if (callee.type !== "Identifier") return false;
	if (matchesSolidName(callee.name, aliases, canonical)) return true;
	const traced = trace(callee, context);
	if (traced.type === "Identifier" && canonical.has(traced.name)) return true;
	return traced.type === "ImportSpecifier" && traced.parent?.type === "ImportDeclaration" && traced.parent.source.type === "Literal" && traced.parent.source.value === "solid-js" && traced.imported.type === "Identifier" && canonical.has(traced.imported.name);
}
var no_react_deps_default = createRule$9({
	meta: {
		type: "problem",
		docs: { description: "Disallow React-style dependency arrays in Solid computations." },
		fixable: "code",
		schema: [],
		messages: {
			noReactDepsMemo: "Solid 2 does not use dependency arrays here. Put dependencies in the compute phase instead.",
			noReactDepsEffect: "Solid 2's `{{name}}` takes the apply callback or an `EffectBundle` as its second argument, not a dependency array. Track dependencies in the compute phase and move side effects into the apply callback."
		}
	},
	defaultOptions: [],
	create(context) {
		const memoAliases = /* @__PURE__ */ new Set();
		const effectAliases = /* @__PURE__ */ new Set();
		return {
			ImportDeclaration(node) {
				collectSolidAliases(node, MEMO_NAMES, memoAliases);
				collectSolidAliases(node, EFFECT_NAMES$2, effectAliases);
			},
			CallExpression(node) {
				if (node.callee.type !== "Identifier") return;
				let kind = null;
				if (resolveSolidFactory(node.callee, context, memoAliases, MEMO_NAMES)) kind = "memo";
				else if (resolveSolidFactory(node.callee, context, effectAliases, EFFECT_NAMES$2)) kind = "effect";
				if (kind == null) return;
				if (node.arguments.length !== 2 || node.arguments.some((argument) => argument.type === "SpreadElement")) return;
				const [firstArg, secondArg] = node.arguments.map((argument) => trace(argument, context));
				if (!isFunctionNode$1(firstArg) || secondArg.type !== "ArrayExpression") return;
				if (kind === "memo") {
					context.report({
						node: node.arguments[1],
						messageId: "noReactDepsMemo",
						fix: secondArg === node.arguments[1] ? (fixer) => fixer.removeRange([firstArg.range[1], node.range[1] - 1]) : void 0
					});
					return;
				}
				context.report({
					node: node.arguments[1],
					messageId: "noReactDepsEffect",
					data: { name: node.callee.name }
				});
			}
		};
	}
});
//#endregion
//#region src/rules/no-async-outside-loading-boundary.ts
const createRule$8 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const SINGLE_ACCESSOR_FACTORIES = new Set(["createMemo", "createProjection"]);
const PAIR_ACCESSOR_FACTORIES$2 = new Set(["createSignal"]);
function isPromiseMemberCallee(callee) {
	if (callee.type !== "MemberExpression" || callee.computed) return false;
	if (callee.property.type !== "Identifier") return false;
	if (callee.property.name === "then" || callee.property.name === "catch" || callee.property.name === "finally") return true;
	if (callee.object.type === "Identifier" && callee.object.name === "Promise" && new Set([
		"resolve",
		"reject",
		"all",
		"allSettled",
		"race",
		"any"
	]).has(callee.property.name)) return true;
	return false;
}
function expressionLooksAsync(node) {
	if (node == null) return false;
	switch (node.type) {
		case "AwaitExpression": return true;
		case "NewExpression": return node.callee.type === "Identifier" && node.callee.name === "Promise";
		case "CallExpression": return isPromiseMemberCallee(node.callee);
		case "ConditionalExpression": return expressionLooksAsync(node.consequent) || expressionLooksAsync(node.alternate);
		case "LogicalExpression": return expressionLooksAsync(node.left) || expressionLooksAsync(node.right);
		case "SequenceExpression": return expressionLooksAsync(node.expressions.at(-1));
		case "ChainExpression": return expressionLooksAsync(node.expression);
		default: return false;
	}
}
function blockHasAsyncReturn(block) {
	const statements = [...block.body];
	while (statements.length > 0) {
		const statement = statements.pop();
		switch (statement.type) {
			case "BlockStatement":
				statements.push(...statement.body);
				break;
			case "IfStatement":
				statements.push(statement.consequent);
				if (statement.alternate) statements.push(statement.alternate);
				break;
			case "DoWhileStatement":
			case "ForInStatement":
			case "ForOfStatement":
			case "ForStatement":
			case "WhileStatement":
			case "LabeledStatement":
			case "WithStatement":
				statements.push(statement.body);
				break;
			case "SwitchStatement":
				for (const switchCase of statement.cases) statements.push(...switchCase.consequent);
				break;
			case "TryStatement":
				statements.push(statement.block);
				if (statement.handler) statements.push(statement.handler.body);
				if (statement.finalizer) statements.push(statement.finalizer);
				break;
			case "ReturnStatement":
				if (expressionLooksAsync(statement.argument)) return true;
				break;
			case "ExpressionStatement":
				if (statement.expression.type === "AwaitExpression" || statement.expression.type === "CallExpression" && isPromiseMemberCallee(statement.expression.callee)) return true;
				break;
			default: break;
		}
	}
	return false;
}
function looksLikeAsyncCompute(node) {
	if (node.async) return true;
	if (node.body.type !== "BlockStatement") return expressionLooksAsync(node.body);
	return blockHasAsyncReturn(node.body);
}
function getJSXElementName(node) {
	const name = node.openingElement.name;
	return name.type === "JSXIdentifier" ? name.name : null;
}
function isDirectlyInJSX(node) {
	let current = node.parent;
	while (current != null) {
		if (current.type === "JSXExpressionContainer" || current.type === "JSXSpreadAttribute") return true;
		if (isFunctionNode$1(current)) return false;
		current = current.parent;
	}
	return false;
}
function hasLoadingAncestor(node, loadingNames) {
	let current = node.parent;
	while (current != null) {
		if (current.type === "JSXElement") {
			const name = getJSXElementName(current);
			if (name != null && loadingNames.has(name)) return true;
		}
		if (isFunctionNode$1(current)) {
			if (current.parent?.type !== "JSXExpressionContainer" && current.parent?.type !== "JSXSpreadAttribute") return false;
		}
		current = current.parent;
	}
	return false;
}
var no_async_outside_loading_boundary_default = createRule$8({
	meta: {
		type: "suggestion",
		docs: { description: "Warn when async computations are read in JSX without a <Loading> boundary (ASYNC_OUTSIDE_LOADING_BOUNDARY)." },
		schema: [],
		messages: { asyncOutsideLoadingBoundary: "'{{name}}' is an async computation. Reading it in JSX without a <Loading> boundary will trigger ASYNC_OUTSIDE_LOADING_BOUNDARY and defer the root mount. Wrap with <Loading fallback={...}> for explicit fallback UI." }
	},
	defaultOptions: [],
	create(context) {
		const sourceCode = context.sourceCode;
		const singleAccessorAliases = /* @__PURE__ */ new Set();
		const pairAccessorAliases = /* @__PURE__ */ new Set();
		const loadingNames = new Set(["Loading"]);
		const asyncAccessorVars = /* @__PURE__ */ new Set();
		const matchesFactory = (name, canonical, aliases) => canonical.has(name) || aliases.has(name);
		return {
			ImportDeclaration(node) {
				if (node.source.type !== "Literal") return;
				const source = node.source.value;
				if (source === "solid-js") for (const specifier of node.specifiers) {
					if (specifier.type !== "ImportSpecifier") continue;
					const importedName = specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value;
					if (SINGLE_ACCESSOR_FACTORIES.has(importedName)) singleAccessorAliases.add(specifier.local.name);
					if (PAIR_ACCESSOR_FACTORIES$2.has(importedName)) pairAccessorAliases.add(specifier.local.name);
				}
				if (source === "@solidjs/web") for (const specifier of node.specifiers) {
					if (specifier.type !== "ImportSpecifier") continue;
					if ((specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value) === "Loading") loadingNames.add(specifier.local.name);
				}
			},
			VariableDeclarator(node) {
				if (node.init?.type !== "CallExpression" || node.init.callee.type !== "Identifier") return;
				const calleeName = node.init.callee.name;
				const firstArg = node.init.arguments[0];
				if (!firstArg || firstArg.type === "SpreadElement" || !isFunctionNode$1(firstArg)) return;
				if (!looksLikeAsyncCompute(firstArg)) return;
				let accessorIdentifier = null;
				if (node.id.type === "Identifier" && matchesFactory(calleeName, SINGLE_ACCESSOR_FACTORIES, singleAccessorAliases)) accessorIdentifier = node.id;
				else if (node.id.type === "ArrayPattern" && matchesFactory(calleeName, PAIR_ACCESSOR_FACTORIES$2, pairAccessorAliases)) {
					const first = node.id.elements[0];
					if (first?.type === "Identifier") accessorIdentifier = first;
				}
				if (!accessorIdentifier) return;
				const variable = _typescript_eslint_utils.ASTUtils.findVariable(sourceCode.getScope(accessorIdentifier), accessorIdentifier);
				if (variable) asyncAccessorVars.add(variable);
			},
			CallExpression(node) {
				if (node.callee.type !== "Identifier") return;
				const variable = _typescript_eslint_utils.ASTUtils.findVariable(sourceCode.getScope(node), node.callee);
				if (!variable || !asyncAccessorVars.has(variable)) return;
				if (!isDirectlyInJSX(node)) return;
				if (hasLoadingAncestor(node, loadingNames)) return;
				context.report({
					node,
					messageId: "asyncOutsideLoadingBoundary",
					data: { name: node.callee.name }
				});
			}
		};
	}
});
//#endregion
//#region src/rules/no-signal-in-effect-apply.ts
const createRule$7 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const ACCESSOR_FACTORIES$1 = new Set(["createMemo", "createProjection"]);
const PAIR_ACCESSOR_FACTORIES$1 = new Set(["createOptimistic", "createSignal"]);
const EFFECT_NAMES$1 = new Set(["createEffect", "createRenderEffect"]);
const TRACKED_SCOPES = new Set([
	"createEffect",
	"createMemo",
	"createRenderEffect",
	"untrack"
]);
var no_signal_in_effect_apply_default = createRule$7({
	meta: {
		type: "problem",
		docs: { description: "Disallow calling signal accessors directly in createEffect apply callbacks without untrack." },
		schema: [],
		messages: { noSignalInEffectApply: "Signal '{{name}}' is called directly in an effect apply callback. The apply phase runs untracked — read it in the compute phase and use the passed value, or wrap it in `untrack()`." }
	},
	defaultOptions: [],
	create(context) {
		const sourceCode = context.sourceCode;
		const accessorAliases = /* @__PURE__ */ new Set();
		const pairAccessorAliases = /* @__PURE__ */ new Set();
		const effectAliases = /* @__PURE__ */ new Set();
		const trackedScopeAliases = /* @__PURE__ */ new Set();
		const reactiveVars = /* @__PURE__ */ new Map();
		const applyCallbacks = /* @__PURE__ */ new Set();
		const getInlineFunction = (value) => {
			if (value == null || value.type === "SpreadElement") return null;
			return isFunctionNode$1(value) ? value : null;
		};
		const getApplyCallback = (value) => {
			const direct = getInlineFunction(value);
			if (direct) return direct;
			if (value?.type !== "ObjectExpression") return null;
			for (const property of value.properties) {
				if (property.type !== "Property" || getPropertyName$2(property) !== "effect") continue;
				const fn = getInlineFunction(property.value);
				if (fn) return fn;
			}
			return null;
		};
		const findContainingApplyCallback = (node) => {
			let current = node.parent;
			while (current != null) {
				if (isFunctionNode$1(current)) {
					const parentNode = current.parent;
					if (parentNode?.type === "CallExpression" && parentNode.arguments[0] === current && parentNode.callee.type === "Identifier" && matchesSolidName(parentNode.callee.name, trackedScopeAliases, TRACKED_SCOPES)) return null;
					if (applyCallbacks.has(current)) return current;
				}
				current = current.parent;
			}
			return null;
		};
		return {
			ImportDeclaration(node) {
				collectSolidAliases(node, ACCESSOR_FACTORIES$1, accessorAliases);
				collectSolidAliases(node, PAIR_ACCESSOR_FACTORIES$1, pairAccessorAliases);
				collectSolidAliases(node, EFFECT_NAMES$1, effectAliases);
				collectSolidAliases(node, TRACKED_SCOPES, trackedScopeAliases);
			},
			VariableDeclarator(node) {
				if (node.id.type === "Identifier" && node.init?.type === "CallExpression" && node.init.callee.type === "Identifier" && matchesSolidName(node.init.callee.name, accessorAliases, ACCESSOR_FACTORIES$1)) {
					const variable = _typescript_eslint_utils.ASTUtils.findVariable(sourceCode.getScope(node.id), node.id);
					if (variable) reactiveVars.set(variable, "accessor");
					return;
				}
				if (node.id.type === "ArrayPattern" && node.init?.type === "CallExpression" && node.init.callee.type === "Identifier" && matchesSolidName(node.init.callee.name, pairAccessorAliases, PAIR_ACCESSOR_FACTORIES$1)) {
					const first = node.id.elements[0];
					if (first?.type === "Identifier") {
						const variable = sourceCode.scopeManager?.getDeclaredVariables(node).find((declared) => declared.name === first.name);
						if (variable) reactiveVars.set(variable, "accessor");
					}
				}
			},
			CallExpression(node) {
				if (node.callee.type === "Identifier" && matchesSolidName(node.callee.name, effectAliases, EFFECT_NAMES$1) && node.arguments.length >= 2) {
					const apply = getApplyCallback(node.arguments[1]);
					if (apply) applyCallbacks.add(apply);
				}
				if (node.callee.type !== "Identifier") return;
				const variable = _typescript_eslint_utils.ASTUtils.findVariable(sourceCode.getScope(node), node.callee);
				if (!variable || reactiveVars.get(variable) !== "accessor") return;
				if (findContainingApplyCallback(node) === null) return;
				context.report({
					node,
					messageId: "noSignalInEffectApply",
					data: { name: node.callee.name }
				});
			}
		};
	}
});
//#endregion
//#region src/rules/no-store-proxy-in-effect-apply.ts
const createRule$6 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const EFFECT_NAMES = new Set(["createEffect", "createRenderEffect"]);
const STORE_FACTORIES$1 = new Set(["createOptimisticStore", "createStore"]);
const SAFE_HELPERS = new Set(["deep", "snapshot"]);
var no_store_proxy_in_effect_apply_default = createRule$6({
	meta: {
		type: "problem",
		docs: { description: "Disallow passing store proxies through effect compute functions and reading them in the apply callback." },
		schema: [],
		messages: { noStoreProxyInEffectApply: "Effect apply callbacks run untracked in Solid 2. Extract store properties in the compute phase or use `deep()` before reading them here." }
	},
	defaultOptions: [],
	create(context) {
		const effectAliases = /* @__PURE__ */ new Set();
		const storeAliases = /* @__PURE__ */ new Set();
		const helperAliases = /* @__PURE__ */ new Set();
		const storeVars = /* @__PURE__ */ new Set();
		const sourceCode = context.sourceCode;
		const getFunctionValue = (value) => {
			if (value == null || value.type === "SpreadElement") return null;
			if (value.type === "FunctionExpression" || value.type === "ArrowFunctionExpression") return value;
			const traced = trace(value, context);
			return traced.type === "FunctionExpression" || traced.type === "ArrowFunctionExpression" ? traced : null;
		};
		const getApplyCallback = (value) => {
			const direct = getFunctionValue(value);
			if (direct) return direct;
			if (value?.type !== "ObjectExpression") return null;
			for (const property of value.properties) {
				if (property.type !== "Property" || getPropertyName$2(property) !== "effect") continue;
				const effect = getFunctionValue(property.value);
				if (effect) return effect;
			}
			return null;
		};
		const isStoreSourceExpression = (node) => {
			if (node == null) return false;
			if (node.type === "CallExpression" && resolveSolidCallee(node.callee, context, helperAliases, SAFE_HELPERS) != null) return false;
			if (node.type === "Identifier") {
				const variable = _typescript_eslint_utils.ASTUtils.findVariable(sourceCode.getScope(node), node);
				return variable != null && storeVars.has(variable);
			}
			if (node.type === "MemberExpression") {
				let root = node.object;
				while (root.type === "MemberExpression") root = root.object;
				if (root.type === "Identifier") {
					const variable = _typescript_eslint_utils.ASTUtils.findVariable(sourceCode.getScope(root), root);
					return variable != null && storeVars.has(variable);
				}
			}
			return false;
		};
		return {
			ImportDeclaration(node) {
				collectSolidAliases(node, EFFECT_NAMES, effectAliases);
				collectSolidAliases(node, STORE_FACTORIES$1, storeAliases);
				collectSolidAliases(node, SAFE_HELPERS, helperAliases);
			},
			VariableDeclarator(node) {
				if (node.id.type === "ArrayPattern" && node.init?.type === "CallExpression" && resolveSolidCallee(node.init.callee, context, storeAliases, STORE_FACTORIES$1) != null) {
					const first = node.id.elements[0];
					if (first?.type === "Identifier") {
						const variable = sourceCode.scopeManager?.getDeclaredVariables(node).find((declared) => declared.name === first.name);
						if (variable) storeVars.add(variable);
					}
				}
			},
			CallExpression(node) {
				if (resolveSolidCallee(node.callee, context, effectAliases, EFFECT_NAMES) == null || node.arguments.length < 2) return;
				const compute = getFunctionValue(node.arguments[0]);
				const apply = getApplyCallback(node.arguments[1]);
				if (!compute || !apply) return;
				const returned = getReturnedExpressions(compute).filter((value) => value != null);
				if (returned.length === 0) return;
				if (!returned.some((value) => isStoreSourceExpression(value)) || apply.params.length === 0) return;
				const applyParam = apply.params[0];
				if (applyParam.type !== "Identifier") return;
				const variable = _typescript_eslint_utils.ASTUtils.findVariable(sourceCode.getScope(applyParam), applyParam);
				if (!variable) return;
				for (const reference of variable.references) {
					const identifier = reference.identifier;
					if (reference.init) continue;
					if (identifier.parent?.type === "VariableDeclarator" && identifier.parent.init === identifier && (identifier.parent.id.type === "ObjectPattern" || identifier.parent.id.type === "ArrayPattern")) {
						context.report({
							node: identifier.parent,
							messageId: "noStoreProxyInEffectApply"
						});
						break;
					}
					if (identifier.parent?.type === "SpreadElement") {
						context.report({
							node: identifier.parent,
							messageId: "noStoreProxyInEffectApply"
						});
						break;
					}
					if (identifier.parent?.type === "MemberExpression" && identifier.parent.object === identifier) {
						context.report({
							node: identifier.parent,
							messageId: "noStoreProxyInEffectApply"
						});
						break;
					}
				}
			}
		};
	}
});
//#endregion
//#region src/rules/no-untracked-reactive-read.ts
const createRule$5 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const ACCESSOR_FACTORIES = new Set(["createMemo", "createProjection"]);
const PAIR_ACCESSOR_FACTORIES = new Set(["createOptimistic", "createSignal"]);
const STORE_FACTORIES = new Set(["createOptimisticStore", "createStore"]);
const SAFE_READ_SCOPES = new Set([
	"createEffect",
	"createMemo",
	"createRenderEffect",
	"untrack"
]);
const CONTROL_FLOW_COMPONENTS = new Set([
	"For",
	"Match",
	"Show"
]);
function isFunctionNode(node) {
	return node?.type === "FunctionDeclaration" || node?.type === "FunctionExpression" || node?.type === "ArrowFunctionExpression";
}
function getFunctionName(node) {
	if ((node.type === "FunctionDeclaration" || node.type === "FunctionExpression") && node.id != null) return node.id.name;
	if (node.parent?.type === "VariableDeclarator" && node.parent.id.type === "Identifier") return node.parent.id.name;
	return null;
}
function expressionCanYieldJSX(node) {
	if (node == null) return false;
	switch (node.type) {
		case "JSXElement":
		case "JSXFragment": return true;
		case "ConditionalExpression": return expressionCanYieldJSX(node.consequent) || expressionCanYieldJSX(node.alternate);
		case "LogicalExpression": return expressionCanYieldJSX(node.left) || expressionCanYieldJSX(node.right);
		case "SequenceExpression": return expressionCanYieldJSX(node.expressions.at(-1));
		default: return false;
	}
}
function blockReturnsJSX(block) {
	const statements = [...block.body];
	while (statements.length > 0) {
		const statement = statements.pop();
		switch (statement.type) {
			case "BlockStatement":
				statements.push(...statement.body);
				break;
			case "DoWhileStatement":
			case "ForInStatement":
			case "ForOfStatement":
			case "ForStatement":
			case "WhileStatement":
			case "LabeledStatement":
			case "WithStatement":
				statements.push(statement.body);
				break;
			case "IfStatement":
				statements.push(statement.consequent);
				if (statement.alternate) statements.push(statement.alternate);
				break;
			case "SwitchStatement":
				for (const switchCase of statement.cases) statements.push(...switchCase.consequent);
				break;
			case "TryStatement":
				statements.push(statement.block);
				if (statement.handler) statements.push(statement.handler.body);
				if (statement.finalizer) statements.push(statement.finalizer);
				break;
			case "ReturnStatement":
				if (expressionCanYieldJSX(statement.argument)) return true;
				break;
			default: break;
		}
	}
	return false;
}
function returnsJSX$1(node) {
	if (node.body.type !== "BlockStatement") return expressionCanYieldJSX(node.body);
	return blockReturnsJSX(node.body);
}
function isComponentLike(node) {
	if (node.parent?.type === "JSXExpressionContainer") return false;
	const name = getFunctionName(node);
	return returnsJSX$1(node) && (name == null || !/^[a-z]/.test(name));
}
function getJSXTagName(node) {
	const name = node.openingElement.name;
	return name.type === "JSXIdentifier" ? name.name : null;
}
function isControlFlowCallback(node, controlFlowAliases) {
	return node.parent?.type === "JSXExpressionContainer" && node.parent.parent?.type === "JSXElement" && (() => {
		const tag = getJSXTagName(node.parent.parent);
		return tag != null && (CONTROL_FLOW_COMPONENTS.has(tag) || controlFlowAliases.has(tag));
	})();
}
function getNearestFunctionAncestor(node) {
	let current = node.parent;
	while (current != null) {
		if (isFunctionNode(current)) return current;
		current = current.parent;
	}
	return null;
}
function isInsideSafeReadScope(node, safeReadScopeAliases) {
	let current = node.parent;
	while (current != null) {
		if (isFunctionNode(current)) {
			const parent = current.parent;
			if (parent?.type === "CallExpression" && parent.arguments[0] === current && parent.callee.type === "Identifier" && matchesSolidName(parent.callee.name, safeReadScopeAliases, SAFE_READ_SCOPES)) return true;
		}
		current = current.parent;
	}
	return false;
}
function isInsideJSXRead(node, scopeNode) {
	let current = node;
	while (current != null && current !== scopeNode) {
		if (current.type === "JSXExpressionContainer" || current.type === "JSXSpreadAttribute") return true;
		current = current.parent ?? void 0;
	}
	return false;
}
function getOutermostMemberExpression(node) {
	let current = node;
	while (current.parent?.type === "MemberExpression" && current.parent.object === current) current = current.parent;
	return current;
}
function getMemberRoot(node) {
	let current = node.object;
	while (current.type === "MemberExpression") current = current.object;
	return current;
}
function getReactiveReadNode(node) {
	const outermost = getOutermostMemberExpression(node);
	return outermost.parent?.type === "ChainExpression" ? outermost.parent : outermost;
}
function reportName(node, sourceCode) {
	return sourceCode.getText(node);
}
var no_untracked_reactive_read_default = createRule$5({
	meta: {
		type: "problem",
		docs: { description: "Disallow untracked reactive reads in Solid 2 component bodies and control-flow callback bodies." },
		schema: [],
		messages: { noUntrackedReactiveRead: "Reactive read '{{name}}' will not update here in Solid 2. Move it into JSX, a reactive scope like `createMemo`/`createEffect`, or wrap it in `untrack(...)`." }
	},
	defaultOptions: [],
	create(context) {
		const sourceCode = context.sourceCode;
		const accessorAliases = /* @__PURE__ */ new Set();
		const pairAccessorAliases = /* @__PURE__ */ new Set();
		const storeAliases = /* @__PURE__ */ new Set();
		const safeReadScopeAliases = /* @__PURE__ */ new Set();
		const controlFlowAliases = /* @__PURE__ */ new Set();
		const reactiveVars = /* @__PURE__ */ new Map();
		const strictScopes = [];
		const currentStrictScope = () => strictScopes[strictScopes.length - 1];
		const reportIfNeeded = (node) => {
			const scope = currentStrictScope();
			if (!scope) return;
			if (getNearestFunctionAncestor(node) !== scope.node) return;
			if (isInsideSafeReadScope(node, safeReadScopeAliases) || isInsideJSXRead(node, scope.node)) return;
			context.report({
				node,
				messageId: "noUntrackedReactiveRead",
				data: { name: reportName(node, sourceCode) }
			});
		};
		const registerParam = (identifier, kind) => {
			const variable = _typescript_eslint_utils.ASTUtils.findVariable(sourceCode.getScope(identifier), identifier);
			if (variable) reactiveVars.set(variable, kind);
		};
		const onFunctionEnter = (node) => {
			if (isComponentLike(node)) {
				strictScopes.push({ node });
				const param = node.params[0];
				if (param?.type === "Identifier") registerParam(param, "props");
				return;
			}
			if (isControlFlowCallback(node, controlFlowAliases)) {
				strictScopes.push({ node });
				for (const param of node.params) if (param.type === "Identifier") registerParam(param, "accessor");
			}
		};
		const onFunctionExit = (node) => {
			if (currentStrictScope()?.node === node) strictScopes.pop();
		};
		return {
			ImportDeclaration(node) {
				collectSolidAliases(node, ACCESSOR_FACTORIES, accessorAliases);
				collectSolidAliases(node, PAIR_ACCESSOR_FACTORIES, pairAccessorAliases);
				collectSolidAliases(node, STORE_FACTORIES, storeAliases);
				collectSolidAliases(node, SAFE_READ_SCOPES, safeReadScopeAliases);
				collectSolidAliases(node, CONTROL_FLOW_COMPONENTS, controlFlowAliases);
			},
			VariableDeclarator(node) {
				if (node.id.type === "Identifier" && node.init?.type === "CallExpression") {
					if (node.init.callee.type === "Identifier" && matchesSolidName(node.init.callee.name, accessorAliases, ACCESSOR_FACTORIES)) {
						const variable = _typescript_eslint_utils.ASTUtils.findVariable(sourceCode.getScope(node.id), node.id);
						if (variable) reactiveVars.set(variable, "accessor");
					}
					return;
				}
				if (node.id.type === "ArrayPattern" && node.init?.type === "CallExpression" && node.init.callee.type === "Identifier") {
					if (matchesSolidName(node.init.callee.name, pairAccessorAliases, PAIR_ACCESSOR_FACTORIES)) {
						const first = node.id.elements[0];
						if (first?.type === "Identifier") {
							const variable = sourceCode.scopeManager?.getDeclaredVariables(node).find((declared) => declared.name === first.name);
							if (variable) reactiveVars.set(variable, "accessor");
						}
					}
					if (matchesSolidName(node.init.callee.name, storeAliases, STORE_FACTORIES)) {
						const first = node.id.elements[0];
						if (first?.type === "Identifier") {
							const variable = sourceCode.scopeManager?.getDeclaredVariables(node).find((declared) => declared.name === first.name);
							if (variable) reactiveVars.set(variable, "store");
						}
					}
				}
				if (strictScopes.length > 0 && (node.id.type === "ObjectPattern" || node.id.type === "ArrayPattern") && node.init != null) {
					if (node.init.type === "Identifier") {
						const variable = _typescript_eslint_utils.ASTUtils.findVariable(sourceCode.getScope(node.init), node.init);
						if (variable && reactiveVars.has(variable)) reportIfNeeded(node.init);
					} else if (node.init.type === "CallExpression" && node.init.callee.type === "Identifier") {
						const variable = _typescript_eslint_utils.ASTUtils.findVariable(sourceCode.getScope(node.init), node.init.callee);
						if (variable && reactiveVars.get(variable) === "accessor") reportIfNeeded(node.init);
					} else if (node.init.type === "MemberExpression") {
						const root = getMemberRoot(node.init);
						if (root.type === "Identifier") {
							const variable = _typescript_eslint_utils.ASTUtils.findVariable(sourceCode.getScope(root), root);
							if (variable && (reactiveVars.get(variable) === "props" || reactiveVars.get(variable) === "store")) reportIfNeeded(getReactiveReadNode(node.init) ?? node.init);
						}
					}
				}
			},
			FunctionDeclaration: onFunctionEnter,
			FunctionExpression: onFunctionEnter,
			ArrowFunctionExpression: onFunctionEnter,
			"FunctionDeclaration:exit": onFunctionExit,
			"FunctionExpression:exit": onFunctionExit,
			"ArrowFunctionExpression:exit": onFunctionExit,
			CallExpression(node) {
				if (strictScopes.length === 0 || node.callee.type !== "Identifier") return;
				if (node.parent?.type === "MemberExpression" && node.parent.object === node) return;
				const variable = _typescript_eslint_utils.ASTUtils.findVariable(sourceCode.getScope(node), node.callee);
				if (variable && reactiveVars.get(variable) === "accessor") reportIfNeeded(node.parent?.type === "ChainExpression" ? node.parent : node);
			},
			MemberExpression(node) {
				if (strictScopes.length === 0) return;
				if (node.parent?.type === "MemberExpression" && node.parent.object === node) return;
				const root = getMemberRoot(node);
				if (root.type === "Identifier") {
					const variable = _typescript_eslint_utils.ASTUtils.findVariable(sourceCode.getScope(root), root);
					const kind = variable && reactiveVars.get(variable);
					if (kind === "props" || kind === "store") {
						reportIfNeeded(getReactiveReadNode(node) ?? node);
						return;
					}
				}
				if (root.type === "CallExpression" && root.callee.type === "Identifier") {
					const variable = _typescript_eslint_utils.ASTUtils.findVariable(sourceCode.getScope(root), root.callee);
					if (variable && reactiveVars.get(variable) === "accessor") reportIfNeeded(getReactiveReadNode(node) ?? node);
				}
			}
		};
	}
});
//#endregion
//#region src/rules/no-unknown-namespaces.ts
const createRule$4 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const allowedNamespaces = new Set(["on", "prop"]);
const removedNamespaces = new Map([
	["attr", "`attr:` was removed in Solid 2. Use standard attributes instead."],
	["bool", "`bool:` was removed in Solid 2. Use standard boolean attribute behavior instead."],
	["oncapture", "`oncapture:` was removed in Solid 2. Use `addEventListener(..., { capture: true })` instead."],
	["use", "`use:` directives were removed in Solid 2. Use `ref={directive(...)}` instead."]
]);
const styleNamespaces = new Set(["class", "style"]);
const xmlNamespaces = new Set(["xmlns", "xlink"]);
var no_unknown_namespaces_default = createRule$4({
	meta: {
		type: "problem",
		docs: { description: "Disallow unknown or removed JSX namespaces in Solid 2." },
		hasSuggestions: true,
		schema: [{
			type: "object",
			properties: { allowedNamespaces: {
				type: "array",
				items: { type: "string" },
				uniqueItems: true
			} },
			additionalProperties: false
		}],
		messages: {
			component: "Namespaced props have no effect on Solid components.",
			componentSuggest: "Replace `{{namespace}}:{{name}}` with `{{name}}`.",
			removed: "{{message}}",
			style: "Prefer the `{{namespace}}` prop over the `{{namespace}}:` namespace in Solid 2.",
			unknown: "`{{namespace}}:` is not a known Solid 2 JSX namespace."
		}
	},
	defaultOptions: [],
	create(context) {
		const extras = new Set(context.options[0]?.allowedNamespaces ?? []);
		return { "JSXAttribute > JSXNamespacedName"(node) {
			const openingElement = node.parent.parent;
			if (openingElement.name.type === "JSXIdentifier" && !isDOMElementName(openingElement.name.name)) {
				context.report({
					node,
					messageId: "component",
					suggest: [{
						messageId: "componentSuggest",
						data: {
							namespace: node.namespace.name,
							name: node.name.name
						},
						fix: (fixer) => fixer.replaceText(node, node.name.name)
					}]
				});
				return;
			}
			const namespace = node.namespace.name;
			if (allowedNamespaces.has(namespace) || xmlNamespaces.has(namespace) || extras.has(namespace)) return;
			const removedMessage = removedNamespaces.get(namespace);
			if (removedMessage) {
				context.report({
					node,
					messageId: "removed",
					data: { message: removedMessage }
				});
				return;
			}
			if (styleNamespaces.has(namespace)) {
				context.report({
					node,
					messageId: "style",
					data: { namespace }
				});
				return;
			}
			context.report({
				node,
				messageId: "unknown",
				data: { namespace }
			});
		} };
	}
});
//#endregion
//#region src/rules/prefer-for.ts
const createRule$3 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const getPropertyName = (node) => {
	if (!node.computed && node.property.type === "Identifier") return node.property.name;
	if (node.computed && node.property.type === "Literal" && typeof node.property.value === "string") return node.property.value;
	return null;
};
function returnsJSX(node) {
	if (node.body.type === "JSXElement" || node.body.type === "JSXFragment") return true;
	if (node.body.type !== "BlockStatement") return false;
	const returnStatement = node.body.body.find((statement) => statement.type === "ReturnStatement");
	return returnStatement?.argument?.type === "JSXElement" || returnStatement?.argument?.type === "JSXFragment";
}
var prefer_for_default = createRule$3({
	meta: {
		type: "suggestion",
		docs: { description: "Prefer Solid's <For /> component over Array#map when rendering JSX lists." },
		fixable: "code",
		schema: [],
		messages: { preferFor: "Use Solid's `<For />` component for rendering JSX lists instead of `Array#map(...)`." }
	},
	defaultOptions: [],
	create(context) {
		const sourceCode = context.sourceCode;
		return { CallExpression(node) {
			const containerNode = node.parent?.type === "ChainExpression" ? node.parent : node;
			if (containerNode.parent?.type !== "JSXExpressionContainer" || !isJSXElementOrFragment(containerNode.parent.parent)) return;
			const callee = node.callee;
			if (callee.type !== "MemberExpression" || node.arguments.length === 0) return;
			if (node.arguments[0].type === "SpreadElement") return;
			if (getPropertyName(callee) !== "map") return;
			const mapFn = node.arguments[0];
			if (!isFunctionNode$1(mapFn) || !returnsJSX(mapFn)) return;
			const canAutoFix = node.arguments.length === 1 && mapFn.params.every((param) => param.type === "Identifier") && sourceCode.scopeManager?.acquire(mapFn) != null;
			context.report({
				node,
				messageId: "preferFor",
				fix: canAutoFix ? (fixer) => {
					const jsxExpressionContainerNode = containerNode.parent;
					const arrayNode = callee.object;
					const mapFnNode = node.arguments[0];
					const scope = sourceCode.scopeManager.acquire(mapFn);
					const fixes = [
						fixer.replaceTextRange([jsxExpressionContainerNode.range[0], arrayNode.range[0]], "<For each={"),
						fixer.replaceTextRange([arrayNode.range[1], mapFnNode.range[0]], "}>{"),
						fixer.replaceTextRange([mapFnNode.range[1], jsxExpressionContainerNode.range[1]], "}</For>")
					];
					for (const param of mapFn.params) {
						if (param.type !== "Identifier") continue;
						const variable = scope.set.get(param.name);
						if (!variable) continue;
						for (const reference of variable.references) if (reference.isReadOnly()) fixes.push(fixer.replaceText(reference.identifier, `${param.name}()`));
					}
					return fixes;
				} : void 0
			});
		} };
	}
});
//#endregion
//#region src/rules/prefer-show.ts
const createRule$2 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const EXPENSIVE_TYPES = new Set([
	"Identifier",
	"JSXElement",
	"JSXFragment"
]);
var prefer_show_default = createRule$2({
	meta: {
		type: "suggestion",
		docs: { description: "Prefer Solid's <Show /> component for JSX conditionals." },
		fixable: "code",
		schema: [],
		messages: {
			preferShowAnd: "Use Solid's `<Show />` component for conditionally showing content.",
			preferShowTernary: "Use Solid's `<Show />` component for conditionally showing content with a fallback."
		}
	},
	defaultOptions: [],
	create(context) {
		const sourceCode = context.sourceCode;
		const putIntoJSX = (node) => {
			const text = sourceCode.getText(node);
			return isJSXElementOrFragment(node) ? text : `{${text}}`;
		};
		const replaceTarget = (node) => node.parent?.type === "JSXExpressionContainer" && isJSXElementOrFragment(node.parent.parent) ? node.parent : node;
		const logicalExpressionHandler = (node) => {
			if (node.operator !== "&&" || !EXPENSIVE_TYPES.has(node.right.type)) return;
			context.report({
				node,
				messageId: "preferShowAnd"
			});
		};
		const conditionalExpressionHandler = (node) => {
			if (!EXPENSIVE_TYPES.has(node.consequent.type) && !EXPENSIVE_TYPES.has(node.alternate.type)) return;
			context.report({
				node,
				messageId: "preferShowTernary",
				fix: (fixer) => fixer.replaceText(replaceTarget(node), `<Show when={${sourceCode.getText(node.test)}} fallback={${sourceCode.getText(node.alternate)}}>${putIntoJSX(node.consequent)}</Show>`)
			});
		};
		return { JSXExpressionContainer(node) {
			if (!isJSXElementOrFragment(node.parent)) return;
			if (node.expression.type === "LogicalExpression") logicalExpressionHandler(node.expression);
			else if (node.expression.type === "ArrowFunctionExpression" && node.expression.body.type === "LogicalExpression") logicalExpressionHandler(node.expression.body);
			else if (node.expression.type === "ConditionalExpression") conditionalExpressionHandler(node.expression);
			else if (node.expression.type === "ArrowFunctionExpression" && node.expression.body.type === "ConditionalExpression") conditionalExpressionHandler(node.expression.body);
		} };
	}
});
//#endregion
//#region src/rules/self-closing-comp.ts
const createRule$1 = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const voidDOMElementRegex = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/;
const isComponent = (node) => node.name.type === "JSXIdentifier" && !isDOMElementName(node.name.name) || node.name.type === "JSXMemberExpression";
const isVoidDOMElementName = (name) => voidDOMElementRegex.test(name);
const childrenIsEmpty = (node) => node.parent.children.length === 0;
const childrenIsMultilineSpaces = (node) => {
	const children = node.parent.children;
	return children.length === 1 && children[0].type === "JSXText" && children[0].value.includes("\n") && children[0].value.replace(/(?!\xA0)\s/g, "") === "";
};
var self_closing_comp_default = createRule$1({
	meta: {
		type: "layout",
		docs: { description: "Disallow extra closing tags for components without children." },
		fixable: "code",
		schema: [{
			type: "object",
			properties: {
				component: {
					enum: ["all", "none"],
					type: "string"
				},
				html: {
					enum: [
						"all",
						"void",
						"none"
					],
					type: "string"
				}
			},
			additionalProperties: false
		}],
		messages: {
			dontSelfClose: "This element should not be self-closing.",
			selfClose: "Empty components are self-closing."
		}
	},
	defaultOptions: [],
	create(context) {
		const sourceCode = context.sourceCode;
		const shouldBeSelfClosedWhenPossible = (node) => {
			if (isComponent(node)) return (context.options[0]?.component ?? "all") === "all";
			if (node.name.type === "JSXIdentifier" && isDOMElementName(node.name.name)) switch (context.options[0]?.html ?? "all") {
				case "all": return true;
				case "void": return isVoidDOMElementName(node.name.name);
				case "none": return false;
			}
			return true;
		};
		return { JSXOpeningElement(node) {
			if (!(childrenIsEmpty(node) || childrenIsMultilineSpaces(node))) return;
			const shouldSelfClose = shouldBeSelfClosedWhenPossible(node);
			if (shouldSelfClose && !node.selfClosing) context.report({
				node,
				messageId: "selfClose",
				fix: (fixer) => {
					const openingElementEnding = node.range[1] - 1;
					const closingElementEnding = node.parent.closingElement.range[1];
					return fixer.replaceTextRange([openingElementEnding, closingElementEnding], " />");
				}
			});
			else if (!shouldSelfClose && node.selfClosing) context.report({
				node,
				messageId: "dontSelfClose",
				fix: (fixer) => {
					const tagName = sourceCode.getText(node.name);
					const selfCloseEnding = node.range[1];
					const lastTokens = sourceCode.getLastTokens(node, { count: 3 });
					const range = [sourceCode.isSpaceBetween(lastTokens[0], lastTokens[1]) ? selfCloseEnding - 3 : selfCloseEnding - 2, selfCloseEnding];
					return fixer.replaceTextRange(range, `></${tagName}>`);
				}
			});
		} };
	}
});
//#endregion
//#region src/rules/style-prop.ts
const createRule = _typescript_eslint_utils.ESLintUtils.RuleCreator.withoutDocs;
const lengthPercentageRegex = /\b(?:width|height|margin|padding|border-width|font-size)\b/i;
const kebabCase = kebab_case.default;
const parse = style_to_object.default;
const plugin = {
	meta: { name: "eslint-plugin-solid" },
	rules: {
		"components-return-once": components_return_once_default,
		"jsx-no-duplicate-props": jsx_no_duplicate_props_default,
		"jsx-no-script-url": jsx_no_script_url_default,
		"jsx-no-undef": jsx_no_undef_default,
		"jsx-uses-vars": jsx_uses_vars_default,
		"no-array-handlers": no_array_handlers_default,
		"no-cleanup-in-forbidden-scope": no_cleanup_in_forbidden_scope_default,
		"no-destructure": no_destructure_default,
		"no-flush-in-forbidden-scope": no_flush_in_forbidden_scope_default,
		"no-invalid-cleanup-return": no_invalid_cleanup_return_default,
		"no-innerhtml": no_innerhtml_default,
		"no-owned-scope-writes": no_owned_scope_writes_default,
		"no-primitives-in-forbidden-scope": no_primitives_in_forbidden_scope_default,
		"no-react-deps": no_react_deps_default,
		"no-async-outside-loading-boundary": no_async_outside_loading_boundary_default,
		"no-signal-in-effect-apply": no_signal_in_effect_apply_default,
		"no-store-proxy-in-effect-apply": no_store_proxy_in_effect_apply_default,
		"no-untracked-reactive-read": no_untracked_reactive_read_default,
		"no-unknown-namespaces": no_unknown_namespaces_default,
		"prefer-for": prefer_for_default,
		"prefer-show": prefer_show_default,
		"self-closing-comp": self_closing_comp_default,
		"style-prop": createRule({
			meta: {
				type: "problem",
				docs: { description: "Require CSS properties in the `style` prop to be valid and kebab-cased, and require dimensioned numeric values to be strings." },
				fixable: "code",
				schema: [{
					type: "object",
					properties: { allowString: { type: "boolean" } },
					additionalProperties: false
				}],
				messages: {
					invalidStyleProp: "{{name}} is not a valid CSS property.",
					kebabStyleProp: "Use {{kebabName}} instead of {{name}}.",
					numericStyleValue: "This CSS property value should be a string with a unit; Solid does not automatically append a \"px\" unit.",
					stringStyle: "Use an object for the style prop instead of a string."
				}
			},
			defaultOptions: [],
			create(context) {
				const allCssPropertiesSet = new Set(known_css_properties.all);
				const allowString = context.options[0]?.allowString ?? false;
				return { JSXAttribute(node) {
					if (jsxPropName(node) !== "style") return;
					const style = node.value?.type === "JSXExpressionContainer" ? node.value.expression : node.value;
					if (!style) return;
					if (style.type === "Literal" && typeof style.value === "string" && !allowString) {
						let objectStyles;
						try {
							objectStyles = parse(style.value) ?? void 0;
						} catch {
							objectStyles = void 0;
						}
						context.report({
							node: style,
							messageId: "stringStyle",
							fix: objectStyles != null ? (fixer) => fixer.replaceText(node.value, `{${JSON.stringify(objectStyles)}}`) : void 0
						});
						return;
					}
					if (style.type === "TemplateLiteral" && !allowString) {
						context.report({
							node: style,
							messageId: "stringStyle"
						});
						return;
					}
					if (style.type !== "ObjectExpression") return;
					for (const prop of style.properties) {
						if (prop.type !== "Property") continue;
						const name = _typescript_eslint_utils.ASTUtils.getPropertyName(prop, context.sourceCode.getScope(prop));
						if (name && !name.startsWith("--") && !allCssPropertiesSet.has(name)) {
							const kebabName = kebabCase(name);
							if (allCssPropertiesSet.has(kebabName)) context.report({
								node: prop.key,
								messageId: "kebabStyleProp",
								data: {
									kebabName,
									name
								},
								fix: (fixer) => fixer.replaceText(prop.key, `"${kebabName}"`)
							});
							else context.report({
								node: prop.key,
								messageId: "invalidStyleProp",
								data: { name }
							});
							continue;
						}
						if (!name || !name.startsWith("--") && lengthPercentageRegex.test(name)) {
							const value = _typescript_eslint_utils.ASTUtils.getStaticValue(prop.value)?.value;
							if (typeof value === "number" && value !== 0) context.report({
								node: prop.value,
								messageId: "numericStyleValue"
							});
						}
					}
				} };
			}
		})
	}
};
//#endregion
//#region src/configs/recommended.ts
const recommended = {
	name: "solid/recommended",
	plugins: { solid: plugin },
	rules: {
		"solid/components-return-once": "warn",
		"solid/jsx-no-duplicate-props": "error",
		"solid/jsx-no-script-url": "error",
		"solid/jsx-no-undef": "error",
		"solid/jsx-uses-vars": "error",
		"solid/no-array-handlers": "off",
		"solid/no-cleanup-in-forbidden-scope": "error",
		"solid/no-destructure": "warn",
		"solid/no-flush-in-forbidden-scope": "error",
		"solid/no-invalid-cleanup-return": "error",
		"solid/no-innerhtml": "error",
		"solid/no-owned-scope-writes": "error",
		"solid/no-primitives-in-forbidden-scope": "error",
		"solid/no-react-deps": "error",
		"solid/no-async-outside-loading-boundary": "warn",
		"solid/no-signal-in-effect-apply": "warn",
		"solid/no-store-proxy-in-effect-apply": "warn",
		"solid/no-untracked-reactive-read": "warn",
		"solid/no-unknown-namespaces": "error",
		"solid/prefer-for": "warn",
		"solid/prefer-show": "warn",
		"solid/self-closing-comp": "warn",
		"solid/style-prop": "warn"
	}
};
//#endregion
//#region src/configs/typescript.ts
const typescriptRules = {
	...recommended.rules,
	"solid/jsx-no-undef": ["error", { typescriptEnabled: true }]
};
const typescript = {
	...recommended,
	name: "solid/typescript",
	rules: typescriptRules
};
//#endregion
//#region src/index.ts
const pluginWithConfigs = {
	...plugin,
	configs: {
		recommended: {
			plugins: ["solid"],
			parserOptions: { ecmaFeatures: { jsx: true } },
			rules: recommended.rules
		},
		typescript: {
			plugins: ["solid"],
			parserOptions: { sourceType: "module" },
			rules: typescript.rules
		},
		"flat/recommended": recommended,
		"flat/typescript": typescript
	}
};
//#endregion
exports.default = pluginWithConfigs;
exports.plugin = plugin;
exports.recommended = recommended;
exports.typescript = typescript;

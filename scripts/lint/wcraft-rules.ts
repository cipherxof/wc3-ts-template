// Custom Deno lint plugin for Warcraft III TypeScript projects.
// Note: Deno requires plugin names to match /^[a-z-]+$/ (lowercase letters and hyphens only).

interface AstNode {
  type: string;
  callee?: {
    type: string;
    name?: string;
  };
  arguments?: Array<{
    type: string;
    value?: unknown;
  }>;
}

interface LintContext {
  filename: string;
  report(descriptor: {
    node: unknown;
    message: string;
    hint?: string;
  }): void;
}

interface ExpressionNode {
  type: string;
  operator?: string;
  left?: ExpressionNode;
  right?: ExpressionNode;
  argument?: ExpressionNode;
  property?: { type: string; name?: string };
  value?: unknown;
}

const ARITHMETIC = new Set(["+", "-", "*", "/", "%", "**"]);

/**
 * True for operands that are numbers or strings by construction. TypeScriptToLua emits JS
 * `||`, `&&` and `!` as Lua `or`, `and` and `not`, where 0 and "" are TRUTHY, so these
 * expressions silently change meaning in game (e.g. `a - b || c - d` never falls through).
 */
function numericOrString(node: ExpressionNode | undefined): boolean {
  if (!node) return false;
  if (node.type === "BinaryExpression") return ARITHMETIC.has(node.operator ?? "");
  if (node.type === "TemplateLiteral") return true;
  if (node.type === "Literal") return typeof node.value === "number" || typeof node.value === "string";
  if (node.type === "MemberExpression") return node.property?.type === "Identifier" && node.property.name === "length";
  return false;
}

const LUA_TRUTHINESS_HINT =
  "In Lua 0 and \"\" are truthy. Compare explicitly (x !== 0, s.length > 0) or use an if/else.";

/** src/ compiles to Lua; scripts/ runs in Deno as JavaScript. Map libraries in .lib/ are linted in their own repos. */
const LUA_SOURCE = /(^|[\\/])src[\\/]/;

interface TreeNode {
  type: string;
  parent?: TreeNode;
  name?: string;
  kind?: string;
  computed?: boolean;
  property?: TreeNode;
  key?: TreeNode;
  init?: TreeNode;
  declarations?: { id?: TreeNode }[];
}

const FUNCTION_TYPES = new Set(["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"]);

export const plugin = {
  name: "wcraft-rules",
  rules: {
    "lua-no-finally": {
      create(context: LintContext) {
        if (!LUA_SOURCE.test(context.filename)) return {};
        return {
          TryStatement(node: { finalizer?: unknown }) {
            if (!node.finalizer) return;
            context.report({
              node,
              message: "`finally` is miscompiled by TypeScriptToLua 1.31",
              hint: "try/finally swallows the error; try/catch/finally skips the finally when the catch rethrows. " +
                "Use `try { ... } catch (e) { cleanup(); throw e; } cleanup();` instead.",
            });
          },
        };
      },
    },
    "lua-loop-closure": {
      create(context: LintContext) {
        if (!LUA_SOURCE.test(context.filename)) return {};
        return {
          Identifier(node: TreeNode) {
            const parent = node.parent;
            // Property names (a.i, { i: 1 }) are not variable references.
            if (parent?.type === "MemberExpression" && parent.property === node && !parent.computed) return;
            if (parent?.type === "Property" && parent.key === node && !parent.computed) return;
            let insideFunction = false;
            for (let current = parent; current; current = current.parent) {
              if (FUNCTION_TYPES.has(current.type)) insideFunction = true;
              if (current.type !== "ForStatement" || !insideFunction) continue;
              const init = current.init;
              if (init?.type !== "VariableDeclaration" || init.kind !== "let") continue;
              if (!(init.declarations ?? []).some(d => d.id?.type === "Identifier" && d.id.name === node.name)) continue;
              context.report({
                node,
                message: `Closure captures loop variable '${node.name}', which TypeScriptToLua shares across iterations`,
                hint: "Copy it first (`const index = i;`) and capture the copy, or use for...of / forEach.",
              });
              return;
            }
          },
        };
      },
    },
    "lua-truthiness": {
      create(context: LintContext) {
        if (!LUA_SOURCE.test(context.filename)) return {};
        return {
          LogicalExpression(node: ExpressionNode) {
            // Only the left operand is tested for truthiness; `x || 0` is the same in both languages.
            if (node.operator === "??" || !numericOrString(node.left)) return;
            context.report({
              node: node.left,
              message: `Number/string left operand of '${node.operator}' behaves differently in Lua`,
              hint: LUA_TRUTHINESS_HINT,
            });
          },
          UnaryExpression(node: ExpressionNode) {
            if (node.operator === "!" && numericOrString(node.argument)) {
              context.report({ node, message: "'!' on a number/string behaves differently in Lua", hint: LUA_TRUTHINESS_HINT });
            }
          },
        };
      },
    },
    "valid-fourcc": {
      create(context: LintContext) {
        return {
          CallExpression(node: AstNode) {
            if (
              node.callee?.type === "Identifier" &&
              node.callee.name === "FourCC" &&
              node.arguments &&
              node.arguments.length > 0
            ) {
              const arg = node.arguments[0];
              if (arg.type === "Literal" && typeof arg.value === "string") {
                const val = arg.value;
                if (val.length !== 4) {
                  context.report({
                    node: arg,
                    message: `FourCC string literal must be exactly 4 characters, received ${val.length} ("${val}")`,
                    hint: "Warcraft III object rawcodes (e.g. 'hfoo', 'A000') must always have a length of 4.",
                  });
                } else if (!/^[\x20-\x7E]{4}$/.test(val)) {
                  context.report({
                    node: arg,
                    message: `FourCC string literal must contain printable ASCII characters only ("${val}")`,
                    hint: "Warcraft III object rawcodes must consist of printable ASCII characters.",
                  });
                }
              }
            }
          },
        };
      },
    },
  },
};

export default plugin;

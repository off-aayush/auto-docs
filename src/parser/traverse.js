import traverse from "@babel/traverse";

/**
 * Traverses a Babel AST.
 *
 * @param {import("@babel/types").File} ast
 * @param {Object} visitors
 */
export function traverseAST(ast, visitors) {
    traverse.default(ast, visitors);
}
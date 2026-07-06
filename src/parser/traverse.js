import traverse from "@babel/traverse";

export function walk(ast, visitor) {
    traverse.default(ast, visitor);
}

import { parse } from "@babel/parser";

/**
 * Converts JavaScript source code into a Babel AST.
 *
 * @param {string} sourceCode
 * @returns {import("@babel/types").File}
 */
export function parseFile(sourceCode) {
    return parse(sourceCode, {
        sourceType: "unambiguous",
        plugins: [
            "jsx",
            "classProperties",
            "dynamicImport",
            "optionalChaining",
            "nullishCoalescingOperator",
        ],
    });
}

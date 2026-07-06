import * as parser from "@babel/parser";

export function parse(code) {
    return parser.parse(code, {
        sourceType: "module",
        plugins: ["jsx", "classProperties", "dynamicImport"],
    });
}

import { traverseAST } from "../parser/traverse.js";

export function analyzeImports(fileModel) {
    traverseAST(fileModel.ast, {
        ImportDeclaration(path) {
            const source = path.node.source.value;

            fileModel.imports.push({
                source,

                type: source.startsWith(".") ? "local" : "external",
            });
        },
    });
}

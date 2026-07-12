import { traverseAST } from "../parser/traverse.js";

export function analyzeExports(fileModel) {
    traverseAST(fileModel.ast, {
        ExportNamedDeclaration(path) {
            if (path.node.declaration) {
                // e.g. export const foo = 1;
                if (path.node.declaration.type === "VariableDeclaration") {
                    path.node.declaration.declarations.forEach(decl => {
                        fileModel.exports.push({
                            name: decl.id.name,
                            type: "NamedExport"
                        });
                    });
                } else if (path.node.declaration.id) {
                    // e.g. export function foo() {}
                    fileModel.exports.push({
                        name: path.node.declaration.id.name,
                        type: "NamedExport"
                    });
                }
            } else {
                // e.g. export { foo, bar };
                path.node.specifiers.forEach(specifier => {
                    fileModel.exports.push({
                        name: specifier.exported.name,
                        type: "NamedExport"
                    });
                });
            }
        },
        ExportDefaultDeclaration(path) {
            let name = "default";
            if (path.node.declaration.id) {
                name = path.node.declaration.id.name;
            }
            fileModel.exports.push({
                name,
                type: "DefaultExport"
            });
        },
        ExportAllDeclaration(path) {
            fileModel.exports.push({
                source: path.node.source.value,
                type: "AllExport"
            });
        }
    });
}

import { traverseAST } from "../parser/traverse.js";

export function analyzeFunctions(fileModel) {
    traverseAST(fileModel.ast, {
        FunctionDeclaration(path) {
            fileModel.functions.push({
                name: path.node.id?.name,

                async: path.node.async,

                params: path.node.params.map((param) => param.name),

                type: "FunctionDeclaration",
            });
        },
    });
}

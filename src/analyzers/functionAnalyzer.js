import { traverseAST } from "../parser/traverse.js";

export function analyzeFunctions(fileModel) {
    const extractFunctionInfo = (path, type, nameNode) => {
        let name = nameNode?.name || "<anonymous>";
        if (type === "ClassMethod" && path.node.key) {
             name = path.node.key.name;
        } else if (type === "ArrowFunctionExpression" && path.parentPath.isVariableDeclarator()) {
             name = path.parentPath.node.id.name;
        }
        
        fileModel.functions.push({
            name,
            async: path.node.async,
            params: path.node.params.map((param) => param.name || "param"),
            type,
            loc: path.node.loc,
        });
    };

    traverseAST(fileModel.ast, {
        FunctionDeclaration(path) {
            extractFunctionInfo(path, "FunctionDeclaration", path.node.id);
        },
        FunctionExpression(path) {
            extractFunctionInfo(path, "FunctionExpression", path.node.id);
        },
        ArrowFunctionExpression(path) {
            extractFunctionInfo(path, "ArrowFunctionExpression", null);
        },
        ClassMethod(path) {
            extractFunctionInfo(path, "ClassMethod", null);
        },
    });
}

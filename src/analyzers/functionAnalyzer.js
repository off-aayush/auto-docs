export function analyzeFunctions(ast) {
    const functions = [];

    walk(ast, {
        FunctionDeclaration(path) {
            functions.push({
                name: path.node.id.name,

                async: path.node.async,

                params: path.node.params.map((p) => p.name),
            });
        },
    });

    return functions;
}

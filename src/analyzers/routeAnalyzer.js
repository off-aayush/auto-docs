import { traverseAST } from "../parser/traverse.js";

export function analyzeRoutes(fileModel) {
    traverseAST(fileModel.ast, {
        CallExpression(path) {
            const callee = path.node.callee;
            
            // Check for pattern like app.get('/route', ...) or router.post('/route', ...)
            if (callee.type === "MemberExpression") {
                const objectName = callee.object.name; // e.g. app, router
                const propertyName = callee.property.name; // e.g. get, post, put, delete, all, use

                const routeMethods = ["get", "post", "put", "delete", "patch", "all"];
                
                // Very basic heuristic for express routes
                if ((objectName === "app" || objectName === "router") && routeMethods.includes(propertyName)) {
                    const args = path.node.arguments;
                    
                    if (args.length >= 1 && (args[0].type === "StringLiteral" || args[0].type === "TemplateLiteral")) {
                        let routePath = "";
                        if (args[0].type === "StringLiteral") {
                            routePath = args[0].value;
                        } else if (args[0].type === "TemplateLiteral" && args[0].quasis.length > 0) {
                            routePath = args[0].quasis[0].value.raw + " (dynamic)";
                        }

                        const getFunctionName = (node) => {
                            if (!node) return "unknown";
                            if (node.type === "Identifier") return node.name;
                            if (node.type === "MemberExpression") {
                                const objName = getFunctionName(node.object);
                                const propName = getFunctionName(node.property);
                                return `${objName}.${propName}`;
                            }
                            if (node.type === "ArrowFunctionExpression") return "<arrow function>";
                            if (node.type === "FunctionExpression") return node.id ? node.id.name : "<function>";
                            if (node.type === "CallExpression") return "<function call>";
                            return `<${node.type}>`;
                        };

                        const middlewares = [];
                        let handler = "none";

                        if (args.length > 1) {
                            handler = getFunctionName(args[args.length - 1]);
                            
                            for (let i = 1; i < args.length - 1; i++) {
                                middlewares.push(getFunctionName(args[i]));
                            }
                        }

                        fileModel.routes.push({
                            method: propertyName.toUpperCase(),
                            path: routePath,
                            handler,
                            middleware: middlewares,
                            loc: path.node.loc
                        });
                    }
                }
            }
        }
    });
}

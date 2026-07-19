import { traverseAST } from "../parser/traverse.js";

export function analyzeReactComponents(fileModel) {
    const components = new Map();

    traverseAST(fileModel.ast, {
        JSXElement(path) {
            // Find the closest enclosing function or class
            const funcPath = path.findParent((p) => p.isFunction() || p.isClass());
            if (!funcPath) return;

            let name = "AnonymousComponent";
            let props = [];
            
            if (funcPath.isFunctionDeclaration() && funcPath.node.id) {
                name = funcPath.node.id.name;
            } else if (funcPath.isArrowFunctionExpression() || funcPath.isFunctionExpression()) {
                if (funcPath.parentPath.isVariableDeclarator() && funcPath.parentPath.node.id.name) {
                    name = funcPath.parentPath.node.id.name;
                }
            } else if (funcPath.isClassDeclaration() && funcPath.node.id) {
                name = funcPath.node.id.name;
            }

            // Only track if it's actually a component-like structure (usually capitalized, but we'll accept any returning JSX)
            if (!components.has(name)) {
                if (funcPath.isFunction()) {
                    const params = funcPath.node.params;
                    if (params.length > 0) {
                        if (params[0].type === "ObjectPattern") {
                            props = params[0].properties.map(prop => prop.key ? prop.key.name : "...");
                        } else if (params[0].type === "Identifier") {
                            props = ["props"]; 
                        }
                    }
                }

                components.set(name, {
                    name,
                    props,
                    hooks: new Set(),
                    jsxElements: new Set(),
                    path: funcPath
                });
            }

            // Extract JSX Element names
            let elementName = "<Unknown>";
            if (path.node.openingElement.name.type === "JSXIdentifier") {
                elementName = path.node.openingElement.name.name;
            } else if (path.node.openingElement.name.type === "JSXMemberExpression") {
                elementName = `${path.node.openingElement.name.object.name}.${path.node.openingElement.name.property.name}`;
            }
            
            components.get(name).jsxElements.add(elementName);
        },
        JSXFragment(path) {
            const funcPath = path.findParent((p) => p.isFunction() || p.isClass());
            if (!funcPath) return;
            
            let name = "AnonymousComponent";
            if (funcPath.isFunctionDeclaration() && funcPath.node.id) name = funcPath.node.id.name;
            else if ((funcPath.isArrowFunctionExpression() || funcPath.isFunctionExpression()) && funcPath.parentPath.isVariableDeclarator()) name = funcPath.parentPath.node.id.name;
            
            if (!components.has(name)) {
                 components.set(name, {
                    name,
                    props: [],
                    hooks: new Set(),
                    jsxElements: new Set(),
                    path: funcPath
                });
            }
            components.get(name).jsxElements.add("<Fragment>");
        }
    });

    // Now find hooks for the components we found
    for (const [name, comp] of components.entries()) {
        comp.path.traverse({
            CallExpression(callPath) {
                if (callPath.node.callee.type === "Identifier" && callPath.node.callee.name.startsWith("use")) {
                    comp.hooks.add(callPath.node.callee.name);
                }
            }
        });

        fileModel.components.push({
            name: comp.name,
            props: comp.props,
            hooks: Array.from(comp.hooks),
            jsxChildren: Array.from(comp.jsxElements),
            loc: comp.path.node.loc
        });
    }
}

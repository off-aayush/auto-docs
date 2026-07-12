import { traverseAST } from "../parser/traverse.js";

export function analyzeClasses(fileModel) {
    traverseAST(fileModel.ast, {
        ClassDeclaration(path) {
            const className = path.node.id ? path.node.id.name : "<anonymous>";
            const superClass = path.node.superClass ? path.node.superClass.name : null;
            
            const properties = [];
            const methods = [];

            path.node.body.body.forEach(member => {
                if (member.type === "ClassProperty") {
                    properties.push(member.key.name);
                } else if (member.type === "ClassMethod") {
                    methods.push({
                        name: member.key.name,
                        kind: member.kind // constructor, method, get, set
                    });
                }
            });

            fileModel.classes.push({
                name: className,
                superClass,
                properties,
                methods
            });
        }
    });
}

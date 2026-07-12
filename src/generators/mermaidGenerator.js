import fs from "fs-extra";
import path from "path";

export async function generateMermaid(dependencyGraph, projectModel, outputDir) {
    // 1. Dependency Graph (Flowchart)
    let graphMermaid = "graph TD;\n";
    dependencyGraph.nodes().forEach(node => {
        // Clean node names for mermaid (remove invalid characters)
        const cleanNode = node.replace(/[^a-zA-Z0-9]/g, "_");
        graphMermaid += `    ${cleanNode}["${node}"];\n`;
    });
    
    dependencyGraph.edges().forEach(edge => {
        const cleanV = edge.v.replace(/[^a-zA-Z0-9]/g, "_");
        const cleanW = edge.w.replace(/[^a-zA-Z0-9]/g, "_");
        graphMermaid += `    ${cleanV} --> ${cleanW};\n`;
    });

    await fs.outputFile(path.join(outputDir, "dependencies.mermaid"), graphMermaid);

    // 2. Class Diagram
    let classMermaid = "classDiagram\n";
    projectModel.files.forEach(file => {
        file.classes.forEach(cls => {
            const cleanClassName = cls.name.replace(/[^a-zA-Z0-9]/g, "_");
            classMermaid += `    class ${cleanClassName} {\n`;
            
            cls.properties.forEach(prop => {
                classMermaid += `        +${prop}\n`;
            });
            
            cls.methods.forEach(method => {
                classMermaid += `        +${method.name}()\n`;
            });

            classMermaid += `    }\n`;

            if (cls.superClass) {
                const cleanSuperClass = cls.superClass.replace(/[^a-zA-Z0-9]/g, "_");
                classMermaid += `    ${cleanSuperClass} <|-- ${cleanClassName}\n`;
            }
        });
    });
    
    await fs.outputFile(path.join(outputDir, "classes.mermaid"), classMermaid);
}

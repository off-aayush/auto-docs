import fs from "fs-extra";
import path from "path";

export async function generateMermaid(dependencyGraph, projectModel, outputDir) {
    // 1. Dependency Graph (Flowchart)
    let graphMermaid = "graph TD;\n";
    
    const categories = {
        Core: [],
        CLI: [],
        Parser: [],
        Scanner: [],
        Analyzers: [],
        Model: [],
        Generators: [],
        Utils: [],
        Other: []
    };

    dependencyGraph.nodes().forEach(node => {
        const lowerNode = node.toLowerCase();
        let matched = false;
        
        for (const cat of Object.keys(categories)) {
            if (cat === "Other") continue;
            // Support both forward slash and backslash matching
            if (lowerNode.includes(`/${cat.toLowerCase()}/`) || lowerNode.includes(`\\${cat.toLowerCase()}\\`)) {
                categories[cat].push(node);
                matched = true;
                break;
            }
        }
        
        if (!matched) {
            categories.Other.push(node);
        }
    });

    for (const [cat, nodes] of Object.entries(categories)) {
        if (nodes.length > 0) {
            if (cat !== "Other") {
                graphMermaid += `    subgraph ${cat}\n`;
            }
            
            nodes.forEach(node => {
                const cleanNode = node.replace(/[^a-zA-Z0-9]/g, "_");
                const indent = cat !== "Other" ? "        " : "    ";
                const nodeData = dependencyGraph.node(node);
                const label = nodeData && nodeData.label ? nodeData.label : node;
                const isExternal = nodeData && nodeData.external;
                const nodeClass = isExternal ? "external" : "internal";
                graphMermaid += `${indent}${cleanNode}["${label}"]:::${nodeClass};\n`;
            });
            
            if (cat !== "Other") {
                graphMermaid += `    end\n`;
            }
        }
    }
    
    dependencyGraph.edges().forEach(edge => {
        const cleanV = edge.v.replace(/[^a-zA-Z0-9]/g, "_");
        const cleanW = edge.w.replace(/[^a-zA-Z0-9]/g, "_");
        graphMermaid += `    ${cleanV} --> ${cleanW};\n`;
    });
    
    graphMermaid += `\n    classDef internal fill:#e0f7fa,stroke:#006064,stroke-width:2px,color:#006064;\n`;
    graphMermaid += `    classDef external fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#e65100;\n`;

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

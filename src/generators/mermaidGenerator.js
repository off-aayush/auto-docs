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
            
            nodes.sort().forEach(node => {
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
    
    // Sort edges and remove duplicates
    const sortedEdges = dependencyGraph.edges().sort((a, b) => {
        if (a.v !== b.v) return a.v.localeCompare(b.v);
        return a.w.localeCompare(b.w);
    });

    const uniqueEdges = [];
    for (let i = 0; i < sortedEdges.length; i++) {
        if (i === 0 || sortedEdges[i].v !== sortedEdges[i-1].v || sortedEdges[i].w !== sortedEdges[i-1].w) {
            uniqueEdges.push(sortedEdges[i]);
        }
    }

    uniqueEdges.forEach(edge => {
        const cleanV = edge.v.replace(/[^a-zA-Z0-9]/g, "_");
        const cleanW = edge.w.replace(/[^a-zA-Z0-9]/g, "_");
        graphMermaid += `    ${cleanV} --> ${cleanW};\n`;
    });
    
    graphMermaid += `\n    classDef internal fill:#e0f7fa,stroke:#006064,stroke-width:2px,color:#006064;\n`;
    graphMermaid += `    classDef external fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#e65100;\n`;

    await fs.outputFile(path.join(outputDir, "dependencies.mermaid"), graphMermaid);

    // 2. Class Diagram
    let classMermaid = "classDiagram\n";
    const sortedFiles = [...projectModel.files].sort((a, b) => a.path.localeCompare(b.path));
    
    sortedFiles.forEach(file => {
        const sortedClasses = [...file.classes].sort((a, b) => a.name.localeCompare(b.name));
        sortedClasses.forEach(cls => {
            const cleanClassName = cls.name.replace(/[^a-zA-Z0-9]/g, "_");
            classMermaid += `    class ${cleanClassName} {\n`;
            
            const sortedProps = [...cls.properties].sort();
            sortedProps.forEach(prop => {
                classMermaid += `        +${prop}\n`;
            });
            
            const sortedMethods = [...cls.methods].sort((a, b) => a.name.localeCompare(b.name));
            sortedMethods.forEach(method => {
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

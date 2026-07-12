import { Graph } from "graphlib";
import path from "path";

export function buildDependencyGraph(projectModel) {
    const graph = new Graph({ directed: true });

    // Add nodes
    projectModel.files.forEach(fileModel => {
        graph.setNode(fileModel.path, { label: fileModel.path });
    });

    // Add edges
    projectModel.files.forEach(fileModel => {
        fileModel.imports.forEach(imp => {
            // Very simple resolution for local imports
            if (imp.type === "local") {
                // Try to resolve the path relative to the file
                const dir = path.dirname(fileModel.path);
                let targetPath = path.posix.join(dir, imp.source);
                
                // If it doesn't end with .js, assume .js for simplicity in this MVP
                if (!targetPath.endsWith(".js")) {
                    targetPath += ".js";
                }

                // Normalizing paths so they match
                targetPath = path.posix.normalize(targetPath);

                if (graph.hasNode(targetPath)) {
                    graph.setEdge(fileModel.path, targetPath);
                } else {
                    // It might be an external node that isn't mapped, or we missed it
                    graph.setNode(targetPath, { label: targetPath, external: true });
                    graph.setEdge(fileModel.path, targetPath);
                }
            } else {
                // External package
                if (!graph.hasNode(imp.source)) {
                    graph.setNode(imp.source, { label: imp.source, external: true });
                }
                graph.setEdge(fileModel.path, imp.source);
            }
        });
    });

    return graph;
}

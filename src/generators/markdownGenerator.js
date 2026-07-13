import fs from "fs-extra";
import path from "path";
import { markdownTable } from "markdown-table";

export async function generateMarkdown(projectModel, outputDir) {
    for (const file of projectModel.files) {
        const mdPath = path.join(outputDir, file.path.replace(/\.js$/, ".md"));
        
        let content = `# ${file.path}\n\n`;

        // Summary
        content += `## Summary\n\n`;
        content += `Analysis of \`${file.path}\`.\n\n`;

        // Metrics
        content += `## Metrics\n\n`;
        const metricsTable = [
            ["Metric", "Count"],
            ["Exports", file.exports?.length || 0],
            ["Functions", file.functions?.length || 0],
            ["Classes", file.classes?.length || 0],
            ["Routes", file.routes?.length || 0],
            ["Components", file.components?.length || 0],
            ["Dependencies", file.imports?.length || 0]
        ];
        content += markdownTable(metricsTable) + "\n\n";

        // Table of Contents
        content += `## Table of Contents\n\n`;
        if (file.exports && file.exports.length > 0) content += `- [Exports](#exports)\n`;
        if (file.functions && file.functions.length > 0) content += `- [Functions](#functions)\n`;
        if (file.classes && file.classes.length > 0) content += `- [Classes](#classes)\n`;
        if (file.routes && file.routes.length > 0) content += `- [Routes](#routes)\n`;
        if (file.components && file.components.length > 0) content += `- [Components](#components)\n`;
        if (file.imports && file.imports.length > 0) content += `- [Dependencies](#dependencies)\n`;
        content += `\n`;

        // Exports
        if (file.exports && file.exports.length > 0) {
            content += `## Exports\n\n`;
            const table = [["Name", "Type"]];
            file.exports.forEach(exp => {
                table.push([exp.name || exp.source, exp.type]);
            });
            content += markdownTable(table) + "\n\n";
        }

        // Functions
        if (file.functions && file.functions.length > 0) {
            content += `## Functions\n\n`;
            const table = [["Name", "Type", "Async", "Params"]];
            file.functions.forEach(func => {
                table.push([
                    func.name, 
                    func.type, 
                    func.async ? "Yes" : "No", 
                    func.params.join(", ")
                ]);
            });
            content += markdownTable(table) + "\n\n";
        }

        // Classes
        if (file.classes && file.classes.length > 0) {
            content += `## Classes\n\n`;
            file.classes.forEach(cls => {
                content += `### ${cls.name}\n\n`;
                if (cls.superClass) {
                    content += `**Extends**: ${cls.superClass}\n\n`;
                }
                
                if (cls.properties.length > 0) {
                    content += `**Properties**:\n`;
                    cls.properties.forEach(prop => content += `- ${prop}\n`);
                    content += `\n`;
                }

                if (cls.methods.length > 0) {
                    const table = [["Method Name", "Kind"]];
                    cls.methods.forEach(method => {
                        table.push([method.name, method.kind]);
                    });
                    content += markdownTable(table) + "\n\n";
                }
            });
        }

        // Routes
        if (file.routes && file.routes.length > 0) {
            content += `## Routes\n\n`;
            const table = [["Method", "Path", "Handler", "Middleware"]];
            file.routes.forEach(route => {
                table.push([
                    route.method, 
                    route.path,
                    route.handler || "-",
                    (route.middleware && route.middleware.length > 0) ? route.middleware.join(", ") : "-"
                ]);
            });
            content += markdownTable(table) + "\n\n";
        }
        
        // Components
        if (file.components && file.components.length > 0) {
            content += `## Components\n\n`;
            const table = [["Name", "Props", "Hooks", "JSX Children"]];
            file.components.forEach(comp => {
                table.push([
                    comp.name,
                    comp.props.length > 0 ? comp.props.join(", ") : "-",
                    comp.hooks.length > 0 ? comp.hooks.join(", ") : "-",
                    comp.jsxChildren.length > 0 ? comp.jsxChildren.join(", ") : "-"
                ]);
            });
            content += markdownTable(table) + "\n\n";
        }

        // Dependencies
        if (file.imports && file.imports.length > 0) {
            content += `## Dependencies\n\n`;
            const table = [["Source", "Type"]];
            file.imports.forEach(imp => {
                table.push([imp.source, imp.type]);
            });
            content += markdownTable(table) + "\n\n";
        }

        await fs.outputFile(mdPath, content);
    }
}

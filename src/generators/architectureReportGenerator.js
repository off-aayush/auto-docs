import fs from "fs-extra";
import path from "path";
import { markdownTable } from "markdown-table";

/**
 * Generate outputDir/ARCHITECTURE.md based on computed repository metrics.
 *
 * @param {import("../analyzers/metricsAnalyzer.js").RepositoryMetrics} metrics
 * @param {import("../model/ProjectModel.js").ProjectModel} projectModel
 * @param {string} outputDir
 * @returns {Promise<void>}
 */
export async function generateArchitectureReport(metrics, projectModel, outputDir) {
    const reportPath = path.join(outputDir, "ARCHITECTURE.md");

    let content = `# Architecture & Repository Intelligence Report\n\n`;

    content += `This report provides static analysis metrics, dependency coupling details, complexity hotspots, and potential dead code analysis for the project **${projectModel.projectName}**.\n\n`;

    // ── 1. Project Statistics ─────────────────────────────────
    content += `## Project Statistics\n\n`;
    
    const stats = metrics.stats;
    const statsTable = [
        ["Metric", "Value"],
        ["Total Files", stats.totalFiles.toString()],
        ["Total Lines of Code (LOC)", stats.totalLOC.toString()],
        ["Total Functions", stats.totalFunctions.toString()],
        ["Total Classes", stats.totalClasses.toString()],
        ["Total Express/API Routes", stats.totalRoutes.toString()],
        ["Total React Components", stats.totalComponents.toString()],
        ["Total Exports", stats.totalExports.toString()],
        ["Total Imports", stats.totalImports.toString()],
        ["Unique External Dependencies", stats.externalDependencies.toString()]
    ];
    content += markdownTable(statsTable) + "\n\n";

    // ── 2. Dependency Health ──────────────────────────────────
    content += `## Dependency Coupling (Fan-In / Fan-Out)\n\n`;
    content += `* **Fan-In**: Number of local files that import this file (higher means more central/highly depended-on).\n`;
    content += `* **Fan-Out**: Number of local files this file imports (higher means more coupled/dependent on others).\n\n`;

    const sortedFanMetrics = [...metrics.fanMetrics].sort((a, b) => b.fanIn - a.fanIn || b.fanOut - a.fanOut);
    const couplingTable = [["File Path", "Fan-In", "Fan-Out", "LOC"]];
    sortedFanMetrics.forEach(fm => {
        couplingTable.push([
            `\`${fm.filePath}\``,
            fm.fanIn.toString(),
            fm.fanOut.toString(),
            fm.loc.toString()
        ]);
    });
    content += markdownTable(couplingTable) + "\n\n";

    // ── 3. Circular Dependencies ──────────────────────────────
    content += `## Circular Dependencies\n\n`;
    if (metrics.circularDeps.length === 0) {
        content += `✓ **No circular dependencies detected!**\n\n`;
    } else {
        content += `⚠️ **Detected ${metrics.circularDeps.length} cycle(s)**:\n\n`;
        metrics.circularDeps.forEach((cycle, index) => {
            content += `### Cycle ${index + 1}\n`;
            const chain = cycle.map(c => `\`${c}\``).join(" → ") + ` → \`${cycle[0]}\``;
            content += `* ${chain}\n\n`;
        });
    }

    // ── 4. Dead Files ─────────────────────────────────────────
    content += `## Dead Files (Zero Inbound Imports)\n\n`;
    content += `Files with zero inbound imports that are not standard entry points (e.g. \`index.js\`, \`main.js\`, \`server.js\`, \`app.js\`).\n\n`;

    if (metrics.deadFiles.length === 0) {
        content += `✓ **No dead files detected.**\n\n`;
    } else {
        content += `The following ${metrics.deadFiles.length} file(s) might be unused/dead:\n\n`;
        metrics.deadFiles.forEach(file => {
            content += `- \`${file}\`\n`;
        });
        content += `\n`;
    }

    // ── 5. Unused Exports ─────────────────────────────────────
    content += `## Unused Exports\n\n`;
    content += `Exports from dead files that are likely unused in the repository:\n\n`;

    if (metrics.unusedExports.length === 0) {
        content += `✓ **No unused exports detected from unreferenced files.**\n\n`;
    } else {
        const unusedTable = [["File Path", "Exported Name", "Export Type"]];
        metrics.unusedExports.forEach(ue => {
            unusedTable.push([
                `\`${ue.filePath}\``,
                `\`${ue.exportName}\``,
                ue.exportType
            ]);
        });
        content += markdownTable(unusedTable) + "\n\n";
    }

    // ── 6. Complexity Hotspots ────────────────────────────────
    content += `## Complexity Hotspots\n\n`;
    content += `Files ranked by structural complexity score (based on functions, classes, routes, components, and external dependencies).\n\n`;

    const sortedComplexity = [...metrics.fanMetrics].sort((a, b) => b.complexity - a.complexity);
    const topComplexity = sortedComplexity.slice(0, 10);

    const complexityTable = [["Rank", "File Path", "Complexity Score", "LOC"]];
    topComplexity.forEach((fm, index) => {
        complexityTable.push([
            (index + 1).toString(),
            `\`${fm.filePath}\``,
            fm.complexity.toString(),
            fm.loc.toString()
        ]);
    });
    content += markdownTable(complexityTable) + "\n\n";

    await fs.outputFile(reportPath, content);
}

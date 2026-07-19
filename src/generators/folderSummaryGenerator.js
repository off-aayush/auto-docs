import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import { markdownTable } from "markdown-table";
import { generateAIFolderSummary } from "./aiGenerator.js";

// Helper function to sleep (to avoid rate limits)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function countLOC(source) {
    if (!source) return 0;
    return source
        .split("\n")
        .filter(line => {
            const trimmed = line.trim();
            return trimmed.length > 0 && !trimmed.startsWith("//") && !trimmed.startsWith("#");
        }).length;
}

export async function generateFolderSummaries(projectModel, outputDir, options = {}) {
    console.log(chalk.blue("\nAnalyzing directory structure..."));

    // 1. Build directory map
    const folders = new Map();
    folders.set(".", { files: [], subdirs: new Set() });

    projectModel.files.forEach(file => {
        const parts = file.path.split(/[/\\]/);
        let current = "";
        for (let i = 0; i < parts.length - 1; i++) {
            const parent = current || ".";
            const dir = current ? current + "/" + parts[i] : parts[i];
            if (!folders.has(dir)) {
                folders.set(dir, { files: [], subdirs: new Set() });
            }
            folders.get(parent).subdirs.add(dir);
            current = dir;
        }
        const fileDir = current || ".";
        folders.get(fileDir).files.push(file);
    });

    // 2. Sort folders keys so we process predictably
    const sortedFolderPaths = [...folders.keys()].sort();

    // 3. Optional: Generate AI Summaries for folders
    const folderSummaries = new Map();
    if (options.ai) {
        console.log(chalk.blue(`Generating AI folder summaries for ${sortedFolderPaths.length} directory/directories...`));
        for (let i = 0; i < sortedFolderPaths.length; i++) {
            const folderPath = sortedFolderPaths[i];
            const data = folders.get(folderPath);
            process.stdout.write(chalk.dim(`  [${i + 1}/${sortedFolderPaths.length}] directory: ${folderPath}...`));
            
            try {
                // Get subdirs relative basenames for metadata
                const subdirNames = [...data.subdirs].map(s => path.basename(s));
                const summary = await generateAIFolderSummary(folderPath, data.files, subdirNames);
                folderSummaries.set(folderPath, summary);
                process.stdout.write(chalk.green(" ✓\n"));
            } catch (err) {
                process.stdout.write(chalk.red(` ✗ (${err.message?.split("\n")[0]})\n`));
                folderSummaries.set(folderPath, null);
            }

            // Sleep to respect Groq rate limits if we have more folders to process
            if (i < sortedFolderPaths.length - 1) {
                await sleep(2000);
            }
        }
    }

    // 4. Generate README.md for each directory
    for (const folderPath of sortedFolderPaths) {
        const data = folders.get(folderPath);
        const stats = computeFolderStats(folderPath, folders);

        let content = `# Directory: \`${folderPath === "." ? "(root)" : folderPath}\`\n\n`;

        // Overview / AI Narrative Summary
        content += `## Overview\n\n`;
        const aiSummary = folderSummaries.get(folderPath);
        if (aiSummary) {
            content += `> ${aiSummary.split("\n").join("\n> ")}\n\n`;
        } else {
            content += `Directory containing ${data.files.length} file(s) and ${data.subdirs.size} subdirectory/subdirectories.\n\n`;
        }

        // Subdirectories List
        if (data.subdirs.size > 0) {
            content += `## Subdirectories\n\n`;
            const sortedSubdirs = [...data.subdirs].sort();
            sortedSubdirs.forEach(subdir => {
                const name = path.basename(subdir);
                const relPath = path.relative(folderPath, subdir).replace(/\\/g, "/") + "/README.md";
                content += `- [${name}](${relPath})\n`;
            });
            content += `\n`;
        }

        // Files List
        if (data.files.length > 0) {
            content += `## Files\n\n`;
            const sortedFiles = [...data.files].sort((a, b) => a.path.localeCompare(b.path));
            sortedFiles.forEach(file => {
                const name = path.basename(file.path);
                const relPath = path.relative(folderPath, file.path.replace(/\.js$/, ".md")).replace(/\\/g, "/");
                const summaryPart = file.aiSummary ? ` - *${file.aiSummary}*` : "";
                content += `- [${name}](${relPath})${summaryPart}\n`;
            });
            content += `\n`;
        }

        // Aggregate Metrics
        content += `## Directory Metrics\n\n`;
        const metricsTable = [
            ["Metric", "Count (This Folder)", "Count (Nested/Total)"],
            ["Files", data.files.length.toString(), stats.totalFilesCount.toString()],
            ["Lines of Code (LOC)", countFolderFilesLOC(data.files).toString(), stats.totalLOC.toString()],
            ["Functions", countFolderFilesFunctions(data.files).toString(), stats.totalFunctions.toString()],
            ["Classes", countFolderFilesClasses(data.files).toString(), stats.totalClasses.toString()],
            ["API Routes", countFolderFilesRoutes(data.files).toString(), stats.totalRoutes.toString()],
            ["React Components", countFolderFilesComponents(data.files).toString(), stats.totalComponents.toString()]
        ];
        content += markdownTable(metricsTable) + "\n\n";

        // Navigation back link to parent if not root
        if (folderPath !== ".") {
            const parentPath = path.dirname(folderPath);
            const relParent = path.relative(folderPath, parentPath || ".").replace(/\\/g, "/") + "/README.md";
            content += `---\n\n[← Back to Parent Directory](${relParent})\n`;
        }

        // Output destination
        const destDir = folderPath === "." ? outputDir : path.join(outputDir, folderPath);
        await fs.ensureDir(destDir);
        await fs.outputFile(path.join(destDir, "README.md"), content);
    }
}

function countFolderFilesLOC(files) {
    return files.reduce((acc, f) => acc + countLOC(f.sourceCode), 0);
}

function countFolderFilesFunctions(files) {
    return files.reduce((acc, f) => acc + (f.functions?.length || 0), 0);
}

function countFolderFilesClasses(files) {
    return files.reduce((acc, f) => acc + (f.classes?.length || 0), 0);
}

function countFolderFilesRoutes(files) {
    return files.reduce((acc, f) => acc + (f.routes?.length || 0), 0);
}

function countFolderFilesComponents(files) {
    return files.reduce((acc, f) => acc + (f.components?.length || 0), 0);
}

function computeFolderStats(folderPath, foldersMap) {
    let totalFilesCount = 0;
    let totalLOC = 0;
    let totalFunctions = 0;
    let totalClasses = 0;
    let totalRoutes = 0;
    let totalComponents = 0;

    function traverse(currentPath) {
        const data = foldersMap.get(currentPath);
        if (!data) return;

        totalFilesCount += data.files.length;
        totalLOC += countFolderFilesLOC(data.files);
        totalFunctions += countFolderFilesFunctions(data.files);
        totalClasses += countFolderFilesClasses(data.files);
        totalRoutes += countFolderFilesRoutes(data.files);
        totalComponents += countFolderFilesComponents(data.files);

        data.subdirs.forEach(subdir => {
            traverse(subdir);
        });
    }

    traverse(folderPath);

    return {
        totalFilesCount,
        totalLOC,
        totalFunctions,
        totalClasses,
        totalRoutes,
        totalComponents
    };
}

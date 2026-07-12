import path from "path";
import { buildDependencyGraph } from "./DependencyGraph.js";
import { generateMarkdown } from "../generators/markdownGenerator.js";
import { generateMermaid } from "../generators/mermaidGenerator.js";
import chalk from "chalk";

export async function generateDocumentation(projectModel, outputDir) {
    console.log(chalk.blue("Building dependency graph..."));
    const dependencyGraph = buildDependencyGraph(projectModel);

    console.log(chalk.blue("Generating markdown files..."));
    await generateMarkdown(projectModel, outputDir);

    console.log(chalk.blue("Generating mermaid diagrams..."));
    await generateMermaid(dependencyGraph, projectModel, outputDir);

    console.log(chalk.blue("AI Documentation placeholder triggered... (skipping actual API call)"));
    // TODO: Connect to Gemini/OpenAI here passing the projectModel context or dependencyGraph
    // For now we just scaffold the hook.
    
    console.log(chalk.green(`\nDocumentation generated successfully in ${outputDir}!`));
}

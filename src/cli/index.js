#!/usr/bin/env node

import { Command } from "commander";
import { loadProject } from "../core/ProjectLoader.js";
import { generateDocumentation } from "../core/DocumentationEngine.js";

export async function startCLI() {
    const program = new Command();

    program
        .name("autodocs")
        .description("Generate technical documentation for JavaScript projects")
        .version("1.0.0")
        .argument("<projectPath>", "Path to the JavaScript project")
        .option("--ai", "Generate AI narrative summaries for each file using Gemini (requires GEMINI_API_KEY)")
        .action(async (projectPath, options) => {
            const project = await loadProject(projectPath);
            await generateDocumentation(project, "output", options);
        });

    await program.parseAsync();
}

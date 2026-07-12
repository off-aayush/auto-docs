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
        .action(async (projectPath) => {
            const project = await loadProject(projectPath);
            await generateDocumentation(project, "output");
        });

    await program.parseAsync();
}

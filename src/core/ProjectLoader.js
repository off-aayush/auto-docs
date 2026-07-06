import ora from "ora";
import chalk from "chalk";

import { scanProject } from "../scanner/scanProject.js";

export async function loadProject(projectPath) {
    const spinner = ora("Scanning project...").start();

    try {
        const files = await scanProject(projectPath);

        spinner.succeed(`Found ${files.length} JavaScript files\n`);

        files.forEach((file) => {
            console.log(chalk.green(file));
        });
    } catch (error) {
        spinner.fail("Failed to scan project.");

        console.error(error.message);
    }
}

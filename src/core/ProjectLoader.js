import fs from "fs-extra";
import path from "path";

import { scanProject } from "../scanner/scanProject.js";
import { parseFile } from "../parser/parser.js";

export async function loadProject(projectPath) {
    const files = await scanProject(projectPath);

    const parsedFiles = [];

    for (const file of files) {
        const absolutePath = path.join(projectPath, file);

        const sourceCode = await fs.readFile(absolutePath, "utf8");

        const ast = parseFile(sourceCode);

        parsedFiles.push({
            path: file,
            sourceCode,
            ast,
        });
    }

    console.log(parsedFiles.length, " parsedFiles length");

    //Inspecting
    // console.log(parsedFiles[0]);
    console.log(
    JSON.stringify(parsedFiles[0].ast.program.body, null, 2)
);
}

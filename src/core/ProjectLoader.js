import path from "path";
import fs from "fs-extra";

import { scanProject } from "../scanner/scanProject.js";
import { parseFile } from "../parser/parser.js";

import { ProjectModel } from "../model/ProjectModel.js";
import { FileModel } from "../model/FileModel.js";

import { analyze } from "./AnalyzerEngine.js";

export async function loadProject(projectPath) {
    const project = new ProjectModel(path.basename(projectPath));

    const files = await scanProject(projectPath);

    for (const file of files) {
        const absolute = path.join(projectPath, file);

        const sourceCode = await fs.readFile(absolute, "utf8");

        const ast = parseFile(sourceCode);

        const fileModel = new FileModel(file, sourceCode, ast);

        analyze(fileModel);

        project.addFile(fileModel);
    }

    return project;
}

import fs from "fs-extra";
import path from "path";
import chalk from "chalk";
import { chunkFile } from "./chunker.js";

/**
 * Compile all files in the project model into a single unified array of structural semantic chunks.
 *
 * @param {import("../model/ProjectModel.js").ProjectModel} projectModel
 * @returns {Object[]}
 */
export function buildRepositoryIndex(projectModel) {
    const allChunks = [];
    projectModel.files.forEach(file => {
        const fileChunks = chunkFile(file);
        allChunks.push(...fileChunks);
    });
    return allChunks;
}

/**
 * Serialize and save the repository index to outputDir/repository_index.json.
 *
 * @param {Object[]} indexData
 * @param {string} outputDir
 * @returns {Promise<void>}
 */
export async function saveRepositoryIndex(indexData, outputDir) {
    const indexPath = path.join(outputDir, "repository_index.json");
    await fs.ensureDir(outputDir);
    await fs.writeJson(indexPath, indexData, { spaces: 2 });
}

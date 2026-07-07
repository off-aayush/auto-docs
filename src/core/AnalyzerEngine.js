import { analyzeImports } from "../analyzers/importAnalyzer.js";

export function analyze(fileModel) {
    analyzeImports(fileModel);
}

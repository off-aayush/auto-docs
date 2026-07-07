import { analyzeImports } from "../analyzers/importAnalyzer.js";
import { analyzeFunctions } from "../analyzers/functionAnalyzer.js";

const analyzers = [analyzeImports, analyzeFunctions];

export function analyze(fileModel) {
    analyzers.forEach((analyzer) => analyzer(fileModel));
}

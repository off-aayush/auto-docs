import { analyzeImports } from "../analyzers/importAnalyzer.js";
import { analyzeFunctions } from "../analyzers/functionAnalyzer.js";
import { analyzeExports } from "../analyzers/exportAnalyzer.js";
import { analyzeClasses } from "../analyzers/classAnalyzer.js";
import { analyzeRoutes } from "../analyzers/routeAnalyzer.js";

const analyzers = [
    analyzeImports,
    analyzeFunctions,
    analyzeExports,
    analyzeClasses,
    analyzeRoutes
];

export function analyze(fileModel) {
    analyzers.forEach((analyzer) => analyzer(fileModel));
}

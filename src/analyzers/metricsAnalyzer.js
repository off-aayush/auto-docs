import path from "path";

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

const normalizeId = (id) => id.replace(/\\/g, "/");

/**
 * Count source lines of code (non-empty, non-comment lines).
 * A lightweight heuristic: skip blank lines and lines that are
 * purely single-line comments ( // … or # … ).
 *
 * @param {string} source
 * @returns {number}
 */
function countLOC(source) {
    if (!source) return 0;
    return source
        .split("\n")
        .filter(line => {
            const trimmed = line.trim();
            return trimmed.length > 0 && !trimmed.startsWith("//") && !trimmed.startsWith("#");
        }).length;
}

/**
 * Compute a simple complexity score for a file.
 *
 * Weighted heuristic (deliberately simple — no AST walk needed
 * because all structural data is already in the FileModel):
 *   +1 per function
 *   +2 per class
 *   +3 per route          (routes imply HTTP surface area)
 *   +2 per React component
 *   +1 per external import (each external dep is a coupling point)
 *
 * @param {import("../model/FileModel.js").FileModel} fileModel
 * @returns {number}
 */
function computeComplexityScore(fileModel) {
    const fns      = fileModel.functions?.length  ?? 0;
    const classes  = fileModel.classes?.length    ?? 0;
    const routes   = fileModel.routes?.length     ?? 0;
    const comps    = fileModel.components?.length ?? 0;
    const extImps  = (fileModel.imports ?? []).filter(i => i.type === "external").length;

    return fns + classes * 2 + routes * 3 + comps * 2 + extImps;
}

// ─────────────────────────────────────────────────────────────
//  Tarjan's Strongly Connected Components (SCC)
//  Used to detect circular dependency cycles.
//
//  Only nodes present in projectModel.files are considered
//  (external packages are excluded).
// ─────────────────────────────────────────────────────────────

/**
 * Run Tarjan's SCC algorithm on the local-file subgraph.
 *
 * @param {string[]} nodeIds           - Normalised file paths
 * @param {Map<string, string[]>} adj  - Adjacency list (source → targets)
 * @returns {string[][]}               - Array of SCCs with >1 member (cycles)
 */
function findCircularDependencies(nodeIds, adj) {
    const index   = new Map();   // node → discovery index
    const lowlink = new Map();   // node → lowest reachable index
    const onStack = new Set();
    const stack   = [];
    const cycles  = [];
    let counter   = 0;

    function strongConnect(v) {
        index.set(v, counter);
        lowlink.set(v, counter);
        counter++;
        stack.push(v);
        onStack.add(v);

        for (const w of (adj.get(v) ?? [])) {
            if (!index.has(w)) {
                strongConnect(w);
                lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)));
            } else if (onStack.has(w)) {
                lowlink.set(v, Math.min(lowlink.get(v), index.get(w)));
            }
        }

        // If v is a root node, pop the SCC
        if (lowlink.get(v) === index.get(v)) {
            const scc = [];
            let w;
            do {
                w = stack.pop();
                onStack.delete(w);
                scc.push(w);
            } while (w !== v);

            if (scc.length > 1) {
                cycles.push(scc);
            }
        }
    }

    for (const node of nodeIds) {
        if (!index.has(node)) {
            strongConnect(node);
        }
    }

    return cycles;
}

// ─────────────────────────────────────────────────────────────
//  Unused Export Detection
//
//  An export is "unused" if its name does not appear in any
//  import specifier across the entire project.
//
//  Limitations (acceptable for static analysis):
//  - Re-exports and dynamic imports are not tracked.
//  - Default exports are tracked as "default".
// ─────────────────────────────────────────────────────────────

/**
 * Build a set of all imported symbol names across the project.
 * Includes named imports and namespace imports.
 *
 * @param {import("../model/ProjectModel.js").ProjectModel} projectModel
 * @returns {Set<string>}
 */
function buildImportedSymbolSet(projectModel) {
    const imported = new Set();
    for (const file of projectModel.files) {
        for (const imp of (file.imports ?? [])) {
            if (imp.specifiers) {
                for (const spec of imp.specifiers) {
                    imported.add(spec);
                }
            }
        }
    }
    return imported;
}

// ─────────────────────────────────────────────────────────────
//  Main export
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} FileFanMetrics
 * @property {string}   filePath    - Normalised file path
 * @property {number}   fanIn       - Number of other local files that import this file
 * @property {number}   fanOut      - Number of local files this file imports
 * @property {number}   complexity  - Weighted complexity heuristic score
 * @property {number}   loc         - Source lines of code (non-blank, non-comment)
 */

/**
 * @typedef {Object} UnusedExport
 * @property {string} filePath
 * @property {string} exportName
 * @property {string} exportType
 */

/**
 * @typedef {Object} ProjectStatistics
 * @property {number} totalFiles
 * @property {number} totalLOC
 * @property {number} totalFunctions
 * @property {number} totalClasses
 * @property {number} totalRoutes
 * @property {number} totalComponents
 * @property {number} totalExports
 * @property {number} totalImports
 * @property {number} externalDependencies  - Unique external package names
 */

/**
 * @typedef {Object} RepositoryMetrics
 * @property {ProjectStatistics}  stats              - Project-wide aggregate statistics
 * @property {FileFanMetrics[]}   fanMetrics         - Per-file fan-in / fan-out / complexity
 * @property {string[][]}         circularDeps       - Arrays of file paths forming cycles
 * @property {string[]}           deadFiles          - Files with fan-in === 0 (unreferenced)
 * @property {UnusedExport[]}     unusedExports      - Exports not imported anywhere
 */

/**
 * Compute all Phase 2 repository metrics from the ProjectModel
 * and its pre-built dependency graph.
 *
 * This function is pure: it reads from the model and graph,
 * writes nothing to disk, and has no side effects.
 *
 * @param {import("../model/ProjectModel.js").ProjectModel} projectModel
 * @param {import("graphlib").Graph} dependencyGraph
 * @returns {RepositoryMetrics}
 */
export function computeMetrics(projectModel, dependencyGraph) {
    const files = projectModel.files;

    // ── Build lookup maps ────────────────────────────────────

    /** @type {Map<string, import("../model/FileModel.js").FileModel>} */
    const fileByNormPath = new Map();
    for (const f of files) {
        fileByNormPath.set(normalizeId(f.path), f);
    }

    const localNodeIds = [...fileByNormPath.keys()];

    // ── Build adjacency list (local files only) ──────────────

    /** @type {Map<string, string[]>} */
    const adj = new Map();
    for (const nodeId of localNodeIds) {
        adj.set(nodeId, []);
    }

    for (const edge of dependencyGraph.edges()) {
        const src = edge.v;
        const tgt = edge.w;
        if (adj.has(src) && adj.has(tgt)) {
            adj.get(src).push(tgt);
        }
    }

    // ── Fan-In / Fan-Out ─────────────────────────────────────

    /** @type {Map<string, number>} fanIn counter */
    const fanInCount  = new Map(localNodeIds.map(n => [n, 0]));
    /** @type {Map<string, number>} fanOut counter */
    const fanOutCount = new Map(localNodeIds.map(n => [n, 0]));

    for (const [src, targets] of adj.entries()) {
        // fanOut = how many local files this file imports
        fanOutCount.set(src, targets.length);
        // fanIn  = how many files import each target
        for (const tgt of targets) {
            fanInCount.set(tgt, (fanInCount.get(tgt) ?? 0) + 1);
        }
    }

    // ── Fan Metrics (per-file) ───────────────────────────────

    /** @type {FileFanMetrics[]} */
    const fanMetrics = localNodeIds.map(nodeId => {
        const fileModel = fileByNormPath.get(nodeId);
        return {
            filePath:   nodeId,
            fanIn:      fanInCount.get(nodeId) ?? 0,
            fanOut:     fanOutCount.get(nodeId) ?? 0,
            complexity: computeComplexityScore(fileModel),
            loc:        countLOC(fileModel?.sourceCode ?? ""),
        };
    });

    // ── Circular Dependencies ────────────────────────────────

    const circularDeps = findCircularDependencies(localNodeIds, adj);

    // ── Dead Files ───────────────────────────────────────────
    //
    // A file is "dead" if:
    //   1. Its fan-in is zero (nothing imports it), AND
    //   2. Its path does not look like a typical entry point
    //      (index.js, cli/index.js, main.js, server.js, app.js)
    //
    const entryPointPattern = /(?:^|[/\\])(?:index|main|server|app)\.js$/i;

    const deadFiles = localNodeIds
        .filter(nodeId => {
            const fi = fanInCount.get(nodeId) ?? 0;
            return fi === 0 && !entryPointPattern.test(nodeId);
        })
        .sort();

    // ── Unused Exports ───────────────────────────────────────
    //
    // Note: importAnalyzer currently only records { source, type }.
    // Specifier-level tracking (which named symbols are imported)
    // would require an importAnalyzer upgrade.  For now we flag
    // exports from dead files as unused — a reliable subset.
    //
    // This is intentionally conservative: false positives (marking
    // a used export as unused) are worse than false negatives.
    //

    const deadFileSet = new Set(deadFiles);

    /** @type {UnusedExport[]} */
    const unusedExports = [];

    for (const nodeId of deadFiles) {
        const fileModel = fileByNormPath.get(nodeId);
        for (const exp of (fileModel?.exports ?? [])) {
            unusedExports.push({
                filePath:   nodeId,
                exportName: exp.name ?? exp.source ?? "unknown",
                exportType: exp.type,
            });
        }
    }

    // ── Project Statistics ───────────────────────────────────

    const externalPackages = new Set();
    let totalFunctions  = 0;
    let totalClasses    = 0;
    let totalRoutes     = 0;
    let totalComponents = 0;
    let totalExports    = 0;
    let totalImports    = 0;
    let totalLOC        = 0;

    for (const file of files) {
        totalFunctions  += file.functions?.length  ?? 0;
        totalClasses    += file.classes?.length    ?? 0;
        totalRoutes     += file.routes?.length     ?? 0;
        totalComponents += file.components?.length ?? 0;
        totalExports    += file.exports?.length    ?? 0;
        totalImports    += file.imports?.length    ?? 0;
        totalLOC        += countLOC(file.sourceCode ?? "");

        for (const imp of (file.imports ?? [])) {
            if (imp.type === "external") {
                // Strip sub-paths: "react-dom/client" → "react-dom"
                externalPackages.add(imp.source.split("/")[0]);
            }
        }
    }

    /** @type {ProjectStatistics} */
    const stats = {
        totalFiles:           files.length,
        totalLOC,
        totalFunctions,
        totalClasses,
        totalRoutes,
        totalComponents,
        totalExports,
        totalImports,
        externalDependencies: externalPackages.size,
    };

    return {
        stats,
        fanMetrics,
        circularDeps,
        deadFiles,
        unusedExports,
    };
}

import path from "path";

/**
 * Slice the source code to extract a specific code snippet based on AST loc object.
 *
 * @param {string} sourceCode
 * @param {Object} loc - AST node location
 * @returns {string}
 */
export function sliceSourceCode(sourceCode, loc) {
    if (!sourceCode || !loc) return "";
    
    const lines = sourceCode.split(/\r?\n/);
    const startLine = loc.start.line - 1;
    const endLine = loc.end.line - 1;

    if (startLine < 0 || startLine >= lines.length) return "";

    if (startLine === endLine) {
        return lines[startLine].slice(loc.start.column, loc.end.column);
    }

    const sliced = [];
    sliced.push(lines[startLine].slice(loc.start.column));
    for (let i = startLine + 1; i < endLine; i++) {
        sliced.push(lines[i]);
    }
    if (endLine < lines.length) {
        sliced.push(lines[endLine].slice(0, loc.end.column));
    }
    return sliced.join("\n");
}

/**
 * Chunk a single FileModel into logical semantic documents.
 *
 * @param {import("../model/FileModel.js").FileModel} fileModel
 * @returns {Object[]} - Array of semantic chunks
 */
export function chunkFile(fileModel) {
    const chunks = [];
    const sourceCode = fileModel.sourceCode;
    const normPath = fileModel.path.replace(/\\/g, "/");

    // 1. File level overview chunk
    let fileOverview = `File: ${normPath}\n`;
    if (fileModel.aiSummary) {
        fileOverview += `Summary: ${fileModel.aiSummary}\n`;
    }
    if (fileModel.exports?.length > 0) {
        fileOverview += `Exports: ${fileModel.exports.map(e => `${e.name || e.source} (${e.type})`).join(", ")}\n`;
    }
    if (fileModel.imports?.length > 0) {
        fileOverview += `Imports: ${fileModel.imports.map(i => i.source).join(", ")}\n`;
    }
    
    chunks.push({
        id: `file:${normPath}`,
        type: "file",
        filePath: normPath,
        name: normPath,
        content: fileOverview.trim(),
        metadata: {
            exportsCount: fileModel.exports?.length || 0,
            importsCount: fileModel.imports?.length || 0,
        }
    });

    // 2. Class chunks
    if (fileModel.classes) {
        fileModel.classes.forEach(cls => {
            const classContent = sliceSourceCode(sourceCode, cls.loc);
            chunks.push({
                id: `class:${normPath}#${cls.name}`,
                type: "class",
                filePath: normPath,
                name: cls.name,
                loc: cls.loc,
                content: classContent || `class ${cls.name}`,
                metadata: {
                    superClass: cls.superClass,
                    properties: cls.properties,
                    methods: cls.methods.map(m => m.name)
                }
            });
        });
    }

    // 3. Function chunks
    if (fileModel.functions) {
        fileModel.functions.forEach(fn => {
            const fnContent = sliceSourceCode(sourceCode, fn.loc);
            chunks.push({
                id: `function:${normPath}#${fn.name}`,
                type: "function",
                filePath: normPath,
                name: fn.name,
                loc: fn.loc,
                content: fnContent || `function ${fn.name}`,
                metadata: {
                    async: fn.async,
                    params: fn.params,
                    functionType: fn.type
                }
            });
        });
    }

    // 4. Route chunks
    if (fileModel.routes) {
        fileModel.routes.forEach(route => {
            const routeContent = sliceSourceCode(sourceCode, route.loc);
            chunks.push({
                id: `route:${normPath}#${route.method}:${route.path}`,
                type: "route",
                filePath: normPath,
                name: `${route.method} ${route.path}`,
                loc: route.loc,
                content: routeContent || `${route.method} ${route.path}`,
                metadata: {
                    method: route.method,
                    path: route.path,
                    handler: route.handler,
                    middleware: route.middleware
                }
            });
        });
    }

    // 5. React Component chunks
    if (fileModel.components) {
        fileModel.components.forEach(comp => {
            const compContent = sliceSourceCode(sourceCode, comp.loc);
            chunks.push({
                id: `component:${normPath}#${comp.name}`,
                type: "component",
                filePath: normPath,
                name: comp.name,
                loc: comp.loc,
                content: compContent || `const ${comp.name} = () => JSX`,
                metadata: {
                    props: comp.props,
                    hooks: comp.hooks,
                    jsxChildren: comp.jsxChildren
                }
            });
        });
    }

    return chunks;
}

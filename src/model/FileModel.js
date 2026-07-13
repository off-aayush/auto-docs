export class FileModel {
    constructor(path, sourceCode, ast) {
        this.path = path;

        this.sourceCode = sourceCode;

        this.ast = ast;

        this.imports = [];

        this.exports = [];

        this.functions = [];

        this.classes = [];

        this.routes = [];

        this.components = [];
    }
}

export class ProjectModel {
    constructor(projectName) {
        this.projectName = projectName;
        this.files = [];
    }

    addFile(fileModel) {
        this.files.push(fileModel);
    }
}

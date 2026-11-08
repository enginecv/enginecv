export type LinkedinImportFailureClass =
    | "too-large"
    | "unrecognized-file"
    | "corrupt-archive"
    | "no-profile-data";

export class LinkedinImportError extends Error {
    readonly failureClass: LinkedinImportFailureClass;

    constructor(failureClass: LinkedinImportFailureClass, message?: string) {
        super(message ?? failureClass);
        this.name = "LinkedinImportError";
        this.failureClass = failureClass;
    }
}

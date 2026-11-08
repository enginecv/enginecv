export type EuropassImportFailureClass =
    | "too-large"
    | "unrecognized-file"
    | "no-europass-data"
    | "corrupt-file";

export class EuropassImportError extends Error {
    readonly failureClass: EuropassImportFailureClass;

    constructor(failureClass: EuropassImportFailureClass, message?: string) {
        super(message ?? failureClass);
        this.name = "EuropassImportError";
        this.failureClass = failureClass;
    }
}

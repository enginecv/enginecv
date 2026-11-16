/**
 * In-memory stand-in for a `FileSystemFileHandle`, for the linked-file tests.
 * It models only what the feature relies on: stamp, content, atomic replace,
 * `move`, external rename or delete, a held exclusive lock, and permissions.
 */

export type FakePermission = "granted" | "denied" | "prompt";

export class FakeDomError extends Error {
    constructor(name: string, message = name) {
        super(message);
        this.name = name;
    }
}

interface FakeFile {
    name: string;
    content: string;
    lastModified: number;
}

/** The "disk" a handle points at; shared by handles for the same file. */
export class FakeDisk {
    files = new Map<string, FakeFile>();
    clock = 1_000;

    tick(by = 1) {
        this.clock += by;
        return this.clock;
    }

    create(name: string, content = ""): FakeFileHandle {
        this.files.set(name, { name, content, lastModified: this.tick() });
        return new FakeFileHandle(this, name);
    }

    /** An outside program writes the file. */
    externalWrite(name: string, content: string, options: { keepStamp?: boolean } = {}) {
        const file = this.files.get(name);
        if (!file) throw new Error(`no such file ${name}`);
        file.content = content;
        if (!options.keepStamp) file.lastModified = this.tick();
    }

    externalRename(from: string, to: string) {
        const file = this.files.get(from);
        if (!file) throw new Error(`no such file ${from}`);
        this.files.delete(from);
        file.name = to;
        this.files.set(to, file);
    }

    externalDelete(name: string) {
        this.files.delete(name);
    }

    read(name: string) {
        return this.files.get(name)?.content;
    }
}

export class FakeFileHandle {
    readonly kind = "file" as const;
    permission: FakePermission = "granted";
    /** Set to make writes fail the way an exclusive lock does. */
    locked = false;
    /** Set to a name to make `move` fail with it. */
    moveError: string | null = null;
    writes = 0;

    constructor(
        readonly disk: FakeDisk,
        public name: string,
    ) {}

    private file() {
        const file = this.disk.files.get(this.name);
        if (!file) throw new FakeDomError("NotFoundError", "A requested file or directory could not be found");
        return file;
    }

    async getFile() {
        const file = this.file();
        if (this.permission !== "granted") throw new FakeDomError("NotAllowedError");
        const snapshot = { ...file };
        return {
            name: snapshot.name,
            size: new TextEncoder().encode(snapshot.content).length,
            lastModified: snapshot.lastModified,
            text: async () => snapshot.content,
        };
    }

    async createWritable() {
        this.file();
        if (this.permission !== "granted") throw new FakeDomError("NotAllowedError");
        if (this.locked) throw new FakeDomError("NoModificationAllowedError", "The file is locked");
        let buffer = "";
        return {
            write: async (data: string) => {
                buffer += data;
            },
            close: async () => {
                if (this.locked) throw new FakeDomError("NoModificationAllowedError");
                const file = this.file();
                file.content = buffer;
                file.lastModified = this.disk.tick();
                this.writes += 1;
            },
        };
    }

    async move(newName: string) {
        if (this.moveError) throw new FakeDomError(this.moveError);
        if (this.disk.files.has(newName) && newName !== this.name) throw new FakeDomError("InvalidModificationError", "exists");
        const file = this.file();
        this.disk.files.delete(this.name);
        file.name = newName;
        this.disk.files.set(newName, file);
        this.name = newName;
    }

    async isSameEntry(other: unknown) {
        return other instanceof FakeFileHandle && other.disk === this.disk && other.name === this.name;
    }

    async queryPermission() {
        return this.permission;
    }

    async requestPermission() {
        if (this.permission === "prompt") this.permission = "granted";
        return this.permission;
    }
}

export function asHandle(handle: FakeFileHandle) {
    return handle as unknown as FileSystemFileHandle;
}

/** File.arrayBuffer with a FileReader fallback (jsdom's File lacks it). */
export async function readFileBytes(file: File): Promise<Uint8Array> {
    if (typeof file.arrayBuffer === "function") {
        return new Uint8Array(await file.arrayBuffer());
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

export async function readFileText(file: File): Promise<string> {
    return new TextDecoder("utf-8", { fatal: false }).decode(await readFileBytes(file));
}

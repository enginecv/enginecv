/** Sort JSON object keys, including integer-looking keys; preserve every array. */
export function sortKeys(text: string): string {
    const write = (value: unknown, depth: number): string => {
        const pad = "  ".repeat(depth + 1);
        const end = "  ".repeat(depth);
        if (Array.isArray(value)) return value.length ? `[\n${value.map(item => pad + write(item, depth + 1)).join(",\n")}\n${end}]` : "[]";
        if (value && typeof value === "object") {
            const object = value as Record<string, unknown>;
            const keys = Object.keys(object).sort();
            return keys.length ? `{\n${keys.map(key => `${pad}${JSON.stringify(key)}: ${write(object[key], depth + 1)}`).join(",\n")}\n${end}}` : "{}";
        }
        return JSON.stringify(value);
    };
    return write(JSON.parse(text), 0);
}

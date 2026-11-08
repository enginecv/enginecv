import { z } from "zod";
import { resumeObjectSchema } from "@/lib/schema";
import type { PathSegment } from "./locate";

export interface JsonSchema {
    [key: string]: unknown;
    $ref?: string;
    $defs?: Record<string, JsonSchema>;
    anyOf?: JsonSchema[];
    oneOf?: JsonSchema[];
    properties?: Record<string, JsonSchema>;
    additionalProperties?: boolean | JsonSchema;
    items?: JsonSchema;
    type?: string | string[];
    enum?: unknown[];
    const?: unknown;
}

let cached: JsonSchema | undefined;
export function buildResumeJsonSchema(): JsonSchema {
    return cached ??= z.toJSONSchema(resumeObjectSchema, { io: "input", unrepresentable: "any", reused: "ref" }) as JsonSchema;
}

export function resolveSchema(root: JsonSchema, node: JsonSchema): JsonSchema {
    const seen = new Set<JsonSchema>();
    while (!seen.has(node)) {
        seen.add(node);
        if (node.$ref?.startsWith("#/")) {
            let target: unknown = root;
            for (const key of node.$ref.slice(2).split("/")) {
                target = (target as Record<string, unknown>)?.[key.replaceAll("~1", "/").replaceAll("~0", "~")];
            }
            if (target && typeof target === "object") { node = target as JsonSchema; continue; }
        }
        const branches = node.anyOf ?? node.oneOf;
        if (branches) {
            const branch = branches.find(part => part.type !== "null");
            if (branch) { node = branch; continue; }
        }
        break;
    }
    return node;
}

export function schemaAt(schema: JsonSchema, path: readonly PathSegment[]): JsonSchema | null {
    let node = schema;
    for (const key of path) {
        node = resolveSchema(schema, node);
        const next = typeof key === "number" ? node.items : node.properties?.[key]
            ?? (typeof node.additionalProperties === "object" ? node.additionalProperties : undefined);
        if (!next) return null;
        node = next;
    }
    return resolveSchema(schema, node);
}

/** Walk the generated schema, preserving records while rejecting stripped keys. */
export function unknownKeyPaths(value: unknown, schema = buildResumeJsonSchema(), path: PathSegment[] = []): PathSegment[][] {
    const node = schemaAt(schema, path);
    if (!node || !value || typeof value !== "object") return [];
    if (Array.isArray(value)) return value.flatMap((item, i) => unknownKeyPaths(item, schema, [...path, i]));
    return Object.entries(value).flatMap(([key, item]) => {
        const child = [...path, key];
        if (node.properties && !Object.hasOwn(node.properties, key) && typeof node.additionalProperties !== "object" && node.additionalProperties !== true) return [child];
        return unknownKeyPaths(item, schema, child);
    });
}

export type TypeDescriptor = { kind: "enum"; values: unknown[] } | { kind: "array"; item: TypeDescriptor } | { kind: "string" | "number" | "integer" | "boolean" | "object" | "null" | "any" };
export function describeType(node: JsonSchema, root: JsonSchema = node): TypeDescriptor {
    node = resolveSchema(root, node);
    if (node.enum) return { kind: "enum", values: node.enum };
    if (Object.hasOwn(node, "const")) return { kind: "enum", values: [node.const] };
    if (node.type === "array") return { kind: "array", item: describeType(node.items ?? {}, root) };
    const kind = typeof node.type === "string" ? node.type : node.properties ? "object" : "any";
    return { kind: ["string", "number", "integer", "boolean", "object", "null"].includes(kind) ? kind as "string" : "any" };
}

export function completionsAt(schema: JsonSchema, path: readonly PathSegment[], presentKeys: string[]): Array<{ key: string; type: string }> {
    const node = schemaAt(schema, path);
    if (!node) return [];
    if (node.properties) return Object.entries(node.properties).filter(([key]) => !presentKeys.includes(key))
        .map(([key, value]) => ({ key, type: describeType(value, schema).kind }));
    const type = describeType(node, schema);
    return type.kind === "enum" ? type.values.map(value => ({ key: JSON.stringify(value), type: "enum" })) : [];
}

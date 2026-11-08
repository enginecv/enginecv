import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { registeredNames } from "./registry";

/*
 * Fails when product code stores something the registry does not list, so
 * the Your data page, the export, the delete and the cookie policy cannot
 * fall behind what the app actually writes.
 */

const SRC = path.join(process.cwd(), "src");
const STORAGE_API = /\b(localStorage|sessionStorage|document\.cookie|indexedDB\.open)\b/;
// Key literals handed to the storage API, or held in a *_KEY / *_COOKIE constant.
const KEY_ARGUMENT = /\b(?:getItem|setItem|removeItem)\(\s*["'`]([^"'`$]+)["'`]/g;
const KEY_CONSTANT = /\bconst\s+\w*(?:KEY|COOKIE)\w*\s*=\s*["'`]([^"'`$]+)["'`]/g;
// Helpers that take the storage object first, e.g. readJson(storage, "key").
const STORAGE_HELPER_ARGUMENT = /\(\s*storage\s*,\s*["'`]([^"'`$]+)["'`]/g;

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return name === "__fixtures__" ? [] : sourceFiles(full);
        if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) return [];
        return [full];
    });
}

function keysIn(source: string): string[] {
    return [KEY_ARGUMENT, KEY_CONSTANT, STORAGE_HELPER_ARGUMENT]
        .flatMap((pattern) => [...source.matchAll(pattern)])
        .map((match) => match[1]);
}

describe("storage registry coverage", () => {
    const files = sourceFiles(SRC).filter((file) => STORAGE_API.test(readFileSync(file, "utf8")));

    it("recognises every way a key is written in source", () => {
        const source = [
            `localStorage.setItem("a", "1");`,
            `const DISMISS_KEY = "b";`,
            `readJson(storage, "c");`,
            `legacyBoolean(storage, "d", true);`,
        ].join("\n");
        expect(keysIn(source)).toEqual(["a", "b", "c", "d"]);
    });

    it("finds the files that touch browser storage", () => {
        expect(files.length).toBeGreaterThan(3);
    });

    it("registers every key the app stores or reads", () => {
        const registered = registeredNames();
        const unregistered = files.flatMap((file) =>
            keysIn(readFileSync(file, "utf8"))
                .filter((key) => !registered.has(key))
                .map((key) => `${path.relative(SRC, file)}: ${key}`),
        );
        expect(unregistered, "add these to src/lib/storage-registry/registry.ts").toEqual([]);
    });
});

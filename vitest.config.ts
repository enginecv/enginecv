import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            "collections": fileURLToPath(new URL("./.source", import.meta.url)),
        },
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./test/setup/vitest.setup.ts"],
        include: [
            "src/**/*.test.ts",
            "src/**/*.test.tsx",
            "src/**/*.unit.test.ts",
            "src/**/*.unit.test.tsx",
            "src/**/*.integration.test.ts",
            "src/**/*.integration.test.tsx",
        ],
        exclude: ["e2e/**", ".next/**", "node_modules/**"],
        css: true,
    },
});

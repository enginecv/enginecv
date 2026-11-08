// Polyfill process.env for @xenova/transformers — it calls Object.keys(process.env)
// during module evaluation in env.js, which crashes in Web Worker contexts where
// Next.js/Turbopack does not inject the process global.
// This MUST be in a separate module imported before @xenova/transformers,
// because ES module imports are hoisted above inline code.
if (typeof (globalThis as any).process === "undefined" || (globalThis as any).process?.env == null) {
    (globalThis as any).process = { env: {} };
}

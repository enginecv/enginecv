import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { gzipSync } from "node:zlib";

const build = process.env.NEXT_DIST_DIR || ".next";
const base = JSON.parse(fs.readFileSync(path.join(build, "build-manifest.json"), "utf8"));
const report = {};
for (const [route, entry] of [["/", "(site)/page"], ["/editor/[id]", "(site)/editor/[id]/page"]]) {
    const context = {};
    vm.runInNewContext(fs.readFileSync(path.join(build, "server/app", `${entry}_client-reference-manifest.js`), "utf8"), context);
    const manifest = Object.values(context.__RSC_MANIFEST)[0];
    const chunks = new Set(base.rootMainFiles);
    if (route === "/") {
        const html = fs.readFileSync(path.join(build, "server/app/index.html"), "utf8");
        for (const match of html.matchAll(/<script[^>]*src="\/_next\/([^"]+\.js)"/g)) chunks.add(match[1]);
    }
    // The route entry lists its static dependency chunks. Dynamic imports have
    // separate entries and must not be included in first-load measurements.
    for (const [name, module] of Object.entries(manifest.clientModules)) {
        if (name.replaceAll("\\", "/").includes(`/src/app/${entry}.tsx`)
            || name.includes("RootDocument.tsx")) {
            for (const chunk of module.chunks) if (typeof chunk === "string" && chunk.endsWith(".js")) chunks.add(chunk);
        }
    }
    const files = [...chunks].map(decodeURIComponent).sort();
    report[route] = {
        raw: files.reduce((sum, file) => sum + fs.statSync(path.join(build, file)).size, 0),
        gzip: files.reduce((sum, file) => sum + gzipSync(fs.readFileSync(path.join(build, file))).length, 0),
        files,
    };
}
const output = process.argv[2];
const lazyPath = path.join(build, "react-loadable-manifest.json");
if (fs.existsSync(lazyPath)) {
    const lazy = JSON.parse(fs.readFileSync(lazyPath, "utf8"));
    const initial = new Set(Object.values(report).flatMap(route => route.files));
    report.lazy = Object.fromEntries(Object.entries(lazy).filter(([name]) => /JsonEditorPanel|codemirror-vim|\.\/vim/.test(name)).map(([name, item]) => {
        const files = [...new Set(item.files.filter(file => file.endsWith(".js")).map(decodeURIComponent))].filter(file => !initial.has(file));
        return [name, { gzip: files.reduce((sum, file) => sum + gzipSync(fs.readFileSync(path.join(build, file))).length, 0), files }];
    }));
}
if (output) fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

import { loader } from "fumadocs-core/source";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";
import { blog } from "collections/server";

export const blogSource = loader(toFumadocsSource(blog, []), {
    baseUrl: "/blog",
});

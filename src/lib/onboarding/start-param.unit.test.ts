import { describe, expect, it } from "vitest";
import { parseStartParam, urlWithoutStartParam } from "./start-param";
import { START_PATH_IDS } from "./start-paths";

describe("parseStartParam", () => {
    it("accepts the Paste from AI link", () => {
        expect(parseStartParam("?start=ai")).toBe("ai");
    });

    it.each(START_PATH_IDS)("accepts %s", (id) => {
        expect(parseStartParam(`?start=${id}`)).toBe(id);
    });

    it("ignores unknown, empty and differently cased values", () => {
        expect(parseStartParam("?start=nope")).toBeNull();
        expect(parseStartParam("?start=")).toBeNull();
        expect(parseStartParam("?START=blank")).toBeNull();
        expect(parseStartParam("?start=Blank")).toBeNull();
        expect(parseStartParam("")).toBeNull();
    });

    it("uses the first value when the parameter repeats", () => {
        expect(parseStartParam("?start=blank&start=github")).toBe("blank");
    });

    it("reads it among other parameters", () => {
        expect(parseStartParam("?tab=templates&start=json")).toBe("json");
    });
});

describe("urlWithoutStartParam", () => {
    it("removes start and keeps other parameters and the hash", () => {
        expect(urlWithoutStartParam({ pathname: "/dashboard", search: "?tab=templates&start=json", hash: "#x" }))
            .toBe("/dashboard?tab=templates#x");
    });

    it("returns the bare path when nothing else remains", () => {
        expect(urlWithoutStartParam({ pathname: "/dashboard", search: "?start=blank", hash: "" })).toBe("/dashboard");
    });

    it("removes every repeated start", () => {
        expect(urlWithoutStartParam({ pathname: "/dashboard", search: "?start=blank&utm_source=x&start=github", hash: "" }))
            .toBe("/dashboard?utm_source=x");
    });
});

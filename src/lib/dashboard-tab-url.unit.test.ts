import { describe, expect, it } from "vitest";
import { urlAfterDashboardTabSelect } from "./dashboard-tab-url";

describe("urlAfterDashboardTabSelect", () => {
    it("drops the pinned tab when another tab is selected", () => {
        expect(urlAfterDashboardTabSelect({ pathname: "/dashboard", search: "?tab=templates" }, "resumes")).toBe("/dashboard");
    });

    it("keeps unrelated query parameters", () => {
        expect(urlAfterDashboardTabSelect({ pathname: "/dashboard", search: "?tab=templates&ref=blog" }, "resumes"))
            .toBe("/dashboard?ref=blog");
    });

    it("leaves the URL alone when the pinned tab is selected again", () => {
        expect(urlAfterDashboardTabSelect({ pathname: "/dashboard", search: "?tab=templates" }, "templates")).toBeNull();
    });

    it("leaves the URL alone when no tab is pinned", () => {
        expect(urlAfterDashboardTabSelect({ pathname: "/dashboard", search: "" }, "resumes")).toBeNull();
        expect(urlAfterDashboardTabSelect({ pathname: "/dashboard", search: "?ref=blog" }, "resumes")).toBeNull();
    });
});

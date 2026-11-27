import { describe, expect, it } from "vitest";
import { urlAfterDashboardTabSelect, urlWithApplication } from "./dashboard-tab-url";

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

    it("closes an open application when leaving the Job Tracker", () => {
        expect(urlAfterDashboardTabSelect({ pathname: "/dashboard", search: "?tab=jobs&application=a1" }, "letters")).toBe("/dashboard");
        expect(urlAfterDashboardTabSelect({ pathname: "/dashboard", search: "?application=a1" }, "resumes")).toBe("/dashboard");
        expect(urlAfterDashboardTabSelect({ pathname: "/dashboard", search: "?tab=jobs&application=a1" }, "jobs")).toBeNull();
    });

    it("opens and closes an application by id only", () => {
        expect(urlWithApplication({ pathname: "/dashboard", search: "?ref=blog" }, "a1")).toBe("/dashboard?ref=blog&tab=jobs&application=a1");
        expect(urlWithApplication({ pathname: "/dashboard", search: "?tab=jobs&application=a1" }, null)).toBe("/dashboard?tab=jobs");
    });

    it("leaves the URL alone when no tab is pinned", () => {
        expect(urlAfterDashboardTabSelect({ pathname: "/dashboard", search: "" }, "resumes")).toBeNull();
        expect(urlAfterDashboardTabSelect({ pathname: "/dashboard", search: "?ref=blog" }, "resumes")).toBeNull();
    });
});

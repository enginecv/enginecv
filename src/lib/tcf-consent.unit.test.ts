import { afterEach, describe, expect, it, vi } from "vitest";
import { CMP_READY_EVENT, hasTcfAdConsent, subscribeTcfConsent, type TcfApi, type TcfData } from "./tcf-consent";
import { isAdPageAllowed } from "./ads";

const granted: TcfData = {
    cmpId: 300,
    cmpStatus: "loaded",
    eventStatus: "tcloaded",
    gdprApplies: true,
    tcString: "provided-by-the-certified-cmp",
    listenerId: 1,
    purpose: { consents: { 1: true, 2: true } },
    vendor: { consents: { 755: true } },
};

afterEach(() => { delete window.__tcfapi; });

describe("TCF ad consent", () => {
    it("requires a ready CMP, its TC string, Google vendor permission and necessary purposes", () => {
        expect(hasTcfAdConsent(granted, true)).toBe(true);
        for (const patch of [
            { cmpId: 0 }, { cmpStatus: "loading" }, { eventStatus: "cmpuishown" },
            { gdprApplies: undefined }, { tcString: "" },
            { purpose: { consents: { 1: false, 2: true } } },
            { purpose: { consents: { 1: true, 2: false } } },
            { vendor: { consents: { 755: false } } },
        ]) expect(hasTcfAdConsent({ ...granted, ...patch }, true)).toBe(false);
        expect(hasTcfAdConsent(granted, false)).toBe(false);
        expect(hasTcfAdConsent(null, true)).toBe(false);
    });

    it("accepts the CMP's explicit out-of-scope response, never an unknown region", () => {
        expect(hasTcfAdConsent({ cmpId: 300, gdprApplies: false }, true)).toBe(true);
        expect(hasTcfAdConsent({ cmpId: 300 }, true)).toBe(false);
    });

    it("handles a provider loaded later, changes, revocation and listener cleanup", () => {
        const changed = vi.fn();
        const unsubscribe = subscribeTcfConsent(changed);
        let callback: Parameters<TcfApi>[2] | undefined;
        const api = vi.fn<TcfApi>((command, _version, cb) => {
            if (command === "addEventListener") callback = cb;
        });
        window.__tcfapi = api;
        window.dispatchEvent(new Event(CMP_READY_EVENT));
        callback?.(granted, true);
        expect(changed).toHaveBeenLastCalledWith(true);
        callback?.({ ...granted, eventStatus: "cmpuishown" }, true);
        expect(changed).toHaveBeenCalledTimes(1);
        callback?.({ ...granted, eventStatus: "useractioncomplete", vendor: { consents: {} } }, true);
        expect(changed).toHaveBeenLastCalledWith(false);
        unsubscribe();
        expect(api).toHaveBeenLastCalledWith("removeEventListener", 2, expect.any(Function), 1);
    });
});

describe("ad placement policy", () => {
    it.each(["/editor/123", "/templates/enginecv-modern", "/", "/de", "/contact", "/privacy"])("excludes %s even with ads enabled", (path) => {
        expect(isAdPageAllowed(path, "en")).toBe(false);
    });
    it.each(["/blog", "/de/blog/article", "/resources", "/jobs", "/dashboard", "/cv-examples", "/cv-examples/nurse", "/de/cv-examples/pflegefachkraft"])("allows eligible content on %s", (path) => {
        expect(isAdPageAllowed(path, "en")).toBe(true);
    });
    it("excludes Bosnian content regardless of stored or route preference", () => {
        expect(isAdPageAllowed("/bs/blog/article", "en")).toBe(false);
        expect(isAdPageAllowed("/blog/article", "bs")).toBe(false);
        expect(isAdPageAllowed("/dashboard", "bs")).toBe(false);
        expect(isAdPageAllowed("/bs/cv-examples/nurse", "en")).toBe(false);
    });
});

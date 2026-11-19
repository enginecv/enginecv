import { describe, expect, it } from "vitest";
import { createEmptyResume } from "@/lib/schema";
import { makeCv } from "../../../test/setup/letter-fixtures";
import { missingSenderKeys, resolveSender, senderFromCv } from "./sender";

describe("resolveSender", () => {
    it("uses the CV's values when nothing is overridden", () => {
        const { sender, overridden } = resolveSender(makeCv());
        expect(sender).toMatchObject({ name: "Amina Hodzic", email: "amina@example.com", phone: "+49 30 1234567", signatureName: "Amina Hodzic" });
        expect(overridden).toEqual([]);
    });

    it("replaces only the overridden field and lists it", () => {
        const { sender, overridden } = resolveSender(makeCv(), { email: "work@acme.test" });
        expect(sender.email).toBe("work@acme.test");
        expect(sender.phone).toBe("+49 30 1234567");
        expect(overridden).toEqual(["email"]);
    });

    it("lets an override be an empty string", () => {
        const { sender, overridden } = resolveSender(makeCv(), { phone: "" });
        expect(sender.phone).toBe("");
        expect(overridden).toEqual(["phone"]);
    });

    it("makes the signature follow an overridden name unless the signature is overridden too", () => {
        expect(resolveSender(makeCv(), { name: "A. Hodzic" }).sender.signatureName).toBe("A. Hodzic");
        expect(resolveSender(makeCv(), { name: "A. Hodzic", signatureName: "Amina" }).sender.signatureName).toBe("Amina");
    });

    it("never changes the CV", () => {
        const cv = makeCv();
        const before = structuredClone(cv.basics);
        resolveSender(cv, { name: "Other", email: "x@y.z" });
        expect(cv.basics).toEqual(before);
    });
});

describe("senderFromCv", () => {
    it("builds the address from street, postal code and city, else the location text", () => {
        const cv = makeCv();
        expect(senderFromCv(cv).address).toBe("Berlin, Germany");
        cv.basics.locationParts = { address: "Hauptstr. 1", postalCode: "10115", city: "Berlin", region: "", countryCode: "DE" };
        expect(senderFromCv(cv).address).toBe("Hauptstr. 1\n10115 Berlin");
    });

    it("falls back to the first extra email when the main one is empty", () => {
        const cv = makeCv({ email: "" });
        cv.basics.emails = [{ id: "e", email: "second@example.com", label: "" }];
        expect(senderFromCv(cv).email).toBe("second@example.com");
    });
});

describe("missingSenderKeys", () => {
    it("names the fields a letter should not go out without", () => {
        expect(missingSenderKeys(senderFromCv(createEmptyResume()))).toEqual(["name", "email"]);
        expect(missingSenderKeys(senderFromCv(makeCv()))).toEqual([]);
    });
});

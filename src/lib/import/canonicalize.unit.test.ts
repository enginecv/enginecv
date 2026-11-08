import { describe, expect, it } from "vitest";
import { canonicalizeGithubInput } from "./canonicalize";

describe("canonicalizeGithubInput", () => {
    it.each([
        ["octocat", "octocat"],
        ["  octocat  ", "octocat"],
        ["@octocat", "octocat"],
        ["Octo-Cat", "Octo-Cat"],
        ["github.com/octocat", "octocat"],
        ["https://github.com/octocat", "octocat"],
        ["http://github.com/octocat/", "octocat"],
        ["https://www.github.com/octocat", "octocat"],
        ["https://github.com/octocat?tab=repositories", "octocat"],
        ["https://github.com/octocat/some-repo/tree/main", "octocat"],
        ["GITHUB.COM/octocat", "octocat"],
    ])("resolves %j to %j", (input, expected) => {
        expect(canonicalizeGithubInput(input)).toBe(expected);
    });

    it.each([
        [""],
        ["   "],
        ["foo bar!!"],
        ["-leading-hyphen"],
        ["trailing-hyphen-"],
        ["double--hyphen"],
        ["way-too-long-username-that-exceeds-the-39-character-limit-github-enforces"],
        ["https://gitlab.com/someone"],
        ["https://github.com/"],
        ["user@example.com"],
    ])("rejects %j", (input) => {
        expect(canonicalizeGithubInput(input)).toBeNull();
    });
});

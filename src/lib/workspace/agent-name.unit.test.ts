import { describe, expect, it } from "vitest";
import { agentFromText, cleanAgentName } from "./agent-name";

describe("agent names", () => {
    it("reads the signature from a file, even inside a fence or after an intro", () => {
        expect(agentFromText('{ "format": "x", "edited_by": "Claude Code", "basics": {} }')).toBe("Claude Code");
        expect(agentFromText('Here you go:\n```json\n{ "edited_by":"Codex" }\n```')).toBe("Codex");
        expect(agentFromText('{ "basics": {} }')).toBeNull();
    });

    it("keeps names plain and short: no markup, no control characters, no links", () => {
        expect(cleanAgentName("<script>alert(1)</script>Claude")).toBe("scriptalert(1)scriptClaude");
        expect(cleanAgentName("Claude\u0000 Code\n")).toBe("Claude Code");
        expect(cleanAgentName("x".repeat(200))?.length).toBe(40);
        expect(cleanAgentName("")).toBeNull();
        expect(cleanAgentName("a")).toBeNull();
        expect(cleanAgentName(42)).toBeNull();
        expect(cleanAgentName("https://evil.example/login")).toBe("httpsevil.examplelogin");
    });

    it("ignores a signature that is not a string", () => {
        expect(agentFromText('{ "edited_by": 5 }')).toBeNull();
    });
});

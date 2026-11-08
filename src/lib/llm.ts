"use client";

// Unified LLM provider interface
export type Provider = "local" | "chrome-ai" | "openai" | "gemini" | "groq" | "anthropic" | "openrouter" | "ollama";

interface BaseLLMConfig {
    provider: Provider;
    apiKey?: string;
    model?: string;
}

export interface ChatMessage {
    role: "user" | "ai" | "system";
    content: string;
}

export const generateResumeContent = async (
    messages: ChatMessage[],
    config: BaseLLMConfig
): Promise<string> => {
    if (config.provider === "local") {
        // Invoke WebLLM or local transformers.js task here
        // For now we simulate the local inference call
        return "Local inference not fully loaded yet... Please configure API key or use Ollama for now.";
    }

    if (config.provider !== "ollama" && config.provider !== "chrome-ai" && !config.apiKey) {
        throw new Error(`API Key is required for ${config.provider}`);
    }

    switch (config.provider) {
        case "chrome-ai": {
            const globalObj = window as any;

            // Chrome AI API changes across versions — try all known namespaces:
            // Chrome 131+  → window.LanguageModel
            // Chrome 127-130 → window.ai.languageModel
            // Chrome 127 (old) → window.ai.assistant
            // Chrome 127 (legacy) → window.ai.createTextSession
            const lm =
                globalObj.LanguageModel ??
                globalObj.ai?.languageModel ??
                globalObj.ai?.assistant ??
                null;

            const hasLegacySession = typeof globalObj.ai?.createTextSession === "function";

            if (!lm && !hasLegacySession) {
                throw new Error(
                    "Chrome AI (Prompt API) is not available. Please complete ALL of these steps:\n" +
                    "1. Enable chrome://flags/#prompt-api-for-gemini-nano → 'Enabled'\n" +
                    "2. Enable chrome://flags/#optimization-guide-on-device-model → 'Enabled BypassPerfRequirement'\n" +
                    "3. Go to chrome://components → find 'Optimization Guide On Device Model' → click 'Check for update'\n" +
                    "4. Fully restart Chrome (close all windows)\n" +
                    "Chrome 127+ Dev or Canary channel is recommended."
                );
            }

            let systemPrompt = "You are an AI resume assistant helping the user carefully build their resume. You output correct JSON when requested.";
            const nonSystemMessages = messages.filter(m => {
                if (m.role === "system") {
                    systemPrompt = m.content;
                    return false;
                }
                return true;
            });
            const lastMessage = nonSystemMessages[nonSystemMessages.length - 1]?.content || "";
            const initialPrompts = nonSystemMessages.slice(0, -1).map(m => ({
                role: m.role === "ai" ? "assistant" : "user",
                content: m.content
            }));

            if (lm && typeof lm.create === "function") {
                // Modern API: window.LanguageModel or window.ai.languageModel
                const capabilities = await lm.capabilities?.();
                if (capabilities?.available === "no") {
                    throw new Error(
                        "Chrome AI is unavailable on this device. " +
                        "Make sure the model has downloaded at chrome://components " +
                        "(look for 'Optimization Guide On Device Model' and click 'Check for update')."
                    );
                }
                const session = await lm.create({
                    systemPrompt,
                    initialPrompts: initialPrompts.length > 0 ? initialPrompts : undefined,
                    expectedOutputLanguages: ["en"],
                });
                const result = await session.prompt(lastMessage);
                if (session.destroy) session.destroy();
                return result;
            } else if (hasLegacySession) {
                // Legacy API: window.ai.createTextSession (Chrome 127)
                const session = await globalObj.ai.createTextSession();
                const promptHistory = nonSystemMessages.map(m => `${m.role}: ${m.content}`).join("\n");
                const result = await session.prompt(systemPrompt + "\n" + promptHistory);
                if (session.destroy) session.destroy();
                return result;
            } else {
                throw new Error("Chrome AI API found but no usable methods detected. Please update Chrome.");
            }
        }
        case "openai":
        case "groq":
        case "openrouter": {
            const endpoints: Record<string, string> = {
                openai: "https://api.openai.com/v1/chat/completions",
                groq: "https://api.groq.com/openai/v1/chat/completions",
                openrouter: "https://openrouter.ai/api/v1/chat/completions",
            };

            const models: Record<string, string> = {
                openai: config.model || "gpt-4o-mini",
                groq: config.model || "llama3-8b-8192",
                openrouter: config.model || "meta-llama/llama-3-8b-instruct:free",
            };

            const response = await fetch(endpoints[config.provider], {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.apiKey}`,
                },
                body: JSON.stringify({
                    model: models[config.provider],
                    messages: messages.map(m => ({
                        role: m.role === "ai" ? "assistant" : m.role,
                        content: m.content
                    })),
                }),
            });
            const data = await response.json();
            return data.choices?.[0]?.message?.content || "";
        }

        case "gemini": {
            const model = config.model || "gemini-1.5-flash";

            let systemPrompt = "You are an AI resume assistant helping the user carefully build their resume. You output correct JSON when requested.";
            const contents = messages.filter(m => {
                if (m.role === "system") {
                    systemPrompt = m.content;
                    return false;
                }
                return true;
            }).map(m => ({
                role: m.role === "ai" ? "model" : "user",
                parts: [{ text: m.content }]
            }));

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: systemPrompt }] },
                        contents: contents,
                    }),
                }
            );
            const data = await response.json();
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        }

        case "ollama": {
            const response = await fetch("http://localhost:11434/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: config.model || "llama3",
                    messages: messages.map(m => ({
                        role: m.role === "ai" ? "assistant" : m.role,
                        content: m.content
                    })),
                    stream: false,
                }),
            });
            const data = await response.json();
            return data.message?.content || "";
        }

        default:
            throw new Error(`Provider ${config.provider} not implemented.`);
    }
};

/**
 * Streaming variant — yields string chunks as they arrive from the provider.
 * Use this for token-by-token UI updates.
 */
export async function* streamResumeContent(
    messages: ChatMessage[],
    config: BaseLLMConfig
): AsyncGenerator<string> {
    if (config.provider === "local") {
        yield "Local inference not fully loaded yet... Please configure an API key or use Ollama.";
        return;
    }

    if (config.provider !== "ollama" && config.provider !== "chrome-ai" && !config.apiKey) {
        throw new Error(`API Key is required for ${config.provider}`);
    }

    switch (config.provider) {
        case "chrome-ai": {
            const globalObj = window as any;
            const lm =
                globalObj.LanguageModel ??
                globalObj.ai?.languageModel ??
                globalObj.ai?.assistant ??
                null;
            const hasLegacySession = typeof globalObj.ai?.createTextSession === "function";

            if (!lm && !hasLegacySession) {
                throw new Error(
                    "Chrome AI (Prompt API) is not available. Please complete ALL of these steps:\n" +
                    "1. Enable chrome://flags/#prompt-api-for-gemini-nano → 'Enabled'\n" +
                    "2. Enable chrome://flags/#optimization-guide-on-device-model → 'Enabled BypassPerfRequirement'\n" +
                    "3. Go to chrome://components → find 'Optimization Guide On Device Model' → click 'Check for update'\n" +
                    "4. Fully restart Chrome (close all windows)\n" +
                    "Chrome 127+ Dev or Canary channel is recommended."
                );
            }

            let systemPrompt = "You are an AI resume assistant helping the user carefully build their resume. You output correct JSON when requested.";
            const nonSystemMessages = messages.filter(m => {
                if (m.role === "system") { systemPrompt = m.content; return false; }
                return true;
            });
            const lastMessage = nonSystemMessages[nonSystemMessages.length - 1]?.content || "";
            const initialPrompts = nonSystemMessages.slice(0, -1).map(m => ({
                role: m.role === "ai" ? "assistant" : "user",
                content: m.content,
            }));

            if (lm && typeof lm.create === "function") {
                const session = await lm.create({
                    systemPrompt,
                    initialPrompts: initialPrompts.length > 0 ? initialPrompts : undefined,
                    expectedOutputLanguages: ["en"],
                });
                // promptStreaming returns a ReadableStream<string>
                const stream = session.promptStreaming(lastMessage);
                let previousText = "";
                for await (const chunk of stream) {
                    // Chrome AI streams cumulative text, so yield only the new delta
                    const delta = (chunk as string).slice(previousText.length);
                    previousText = chunk as string;
                    if (delta) yield delta;
                }
                if (session.destroy) session.destroy();
            } else {
                // Legacy: no streaming API, yield full response at once
                const session = await globalObj.ai.createTextSession();
                const promptHistory = nonSystemMessages.map(m => `${m.role}: ${m.content}`).join("\n");
                const result = await session.prompt(systemPrompt + "\n" + promptHistory);
                if (session.destroy) session.destroy();
                yield result;
            }
            return;
        }

        case "openai":
        case "groq":
        case "openrouter": {
            const endpoints: Record<string, string> = {
                openai: "https://api.openai.com/v1/chat/completions",
                groq: "https://api.groq.com/openai/v1/chat/completions",
                openrouter: "https://openrouter.ai/api/v1/chat/completions",
            };
            const models: Record<string, string> = {
                openai: config.model || "gpt-4o-mini",
                groq: config.model || "llama3-8b-8192",
                openrouter: config.model || "meta-llama/llama-3-8b-instruct:free",
            };

            const response = await fetch(endpoints[config.provider], {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.apiKey}`,
                },
                body: JSON.stringify({
                    model: models[config.provider],
                    messages: messages.map(m => ({
                        role: m.role === "ai" ? "assistant" : m.role,
                        content: m.content,
                    })),
                    stream: true,
                }),
            });

            if (!response.body) throw new Error("No response body for streaming");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const lines = decoder.decode(value, { stream: true }).split("\n");
                for (const line of lines) {
                    const trimmed = line.replace(/^data: /, "").trim();
                    if (!trimmed || trimmed === "[DONE]") continue;
                    try {
                        const parsed = JSON.parse(trimmed);
                        const delta = parsed.choices?.[0]?.delta?.content;
                        if (delta) yield delta;
                    } catch {
                        // ignore malformed SSE lines
                    }
                }
            }
            return;
        }

        case "gemini": {
            const model = config.model || "gemini-1.5-flash";
            let systemPrompt = "You are an AI resume assistant helping the user carefully build their resume. You output correct JSON when requested.";
            const contents = messages.filter(m => {
                if (m.role === "system") { systemPrompt = m.content; return false; }
                return true;
            }).map(m => ({
                role: m.role === "ai" ? "model" : "user",
                parts: [{ text: m.content }],
            }));

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${config.apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: systemPrompt }] },
                        contents,
                    }),
                }
            );

            if (!response.body) throw new Error("No response body for Gemini streaming");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const lines = decoder.decode(value, { stream: true }).split("\n");
                for (const line of lines) {
                    const trimmed = line.replace(/^data: /, "").trim();
                    if (!trimmed) continue;
                    try {
                        const parsed = JSON.parse(trimmed);
                        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) yield text;
                    } catch {
                        // ignore
                    }
                }
            }
            return;
        }

        case "anthropic": {
            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": config.apiKey!,
                    "anthropic-version": "2023-06-01",
                    "anthropic-dangerous-direct-browser-calls": "true",
                },
                body: JSON.stringify({
                    model: config.model || "claude-3-haiku-20240307",
                    max_tokens: 1024,
                    stream: true,
                    messages: messages
                        .filter(m => m.role !== "system")
                        .map(m => ({
                            role: m.role === "ai" ? "assistant" : "user",
                            content: m.content,
                        })),
                }),
            });

            if (!response.body) throw new Error("No response body for Anthropic streaming");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const lines = decoder.decode(value, { stream: true }).split("\n");
                for (const line of lines) {
                    const trimmed = line.replace(/^data: /, "").trim();
                    if (!trimmed) continue;
                    try {
                        const parsed = JSON.parse(trimmed);
                        if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                            yield parsed.delta.text;
                        }
                    } catch {
                        // ignore
                    }
                }
            }
            return;
        }

        case "ollama": {
            const response = await fetch("http://localhost:11434/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: config.model || "llama3",
                    messages: messages.map(m => ({
                        role: m.role === "ai" ? "assistant" : m.role,
                        content: m.content,
                    })),
                    stream: true,
                }),
            });

            if (!response.body) throw new Error("No response body for Ollama streaming");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const lines = decoder.decode(value, { stream: true }).split("\n");
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.message?.content) yield parsed.message.content;
                    } catch {
                        // ignore
                    }
                }
            }
            return;
        }

        default:
            throw new Error(`Provider ${config.provider} not implemented.`);
    }
}


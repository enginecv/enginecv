"use client";

import { useState, useRef, useEffect } from "react";
import {
    Send, Bot, User, Loader2, Settings2, Download, Check, ChevronUp,
    Workflow, Box, BrainCircuit, Sparkles, Zap, Globe, Cpu, Hash,
    AlertTriangle, ExternalLink
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { useAI } from "@/hooks/useAI";
import { useResumeStore } from "@/lib/store";
import { createId } from "@/lib/id";
import type { Provider } from "@/lib/llm";
import { useTranslation } from "@/lib/i18n";

const LOCAL_MODELS = [
    { id: "Xenova/TinyLlama-1.1B-Chat-v1.0", name: "TinyLlama 1.1B", size: "700 MB", icon: Box },
    { id: "Xenova/Qwen1.5-0.5B-Chat", name: "Qwen 0.5B", size: "350 MB", icon: Box },
];

const CLOUD_PROVIDERS: { id: Provider, name: string, icon: any }[] = [
    { id: "chrome-ai", name: "Chrome Built-in AI", icon: Sparkles },
    { id: "ollama", name: "Ollama (Local / HTTP)", icon: Hash },
    { id: "openrouter", name: "OpenRouter", icon: Workflow },
    { id: "openai", name: "OpenAI", icon: BrainCircuit },
    { id: "groq", name: "Groq", icon: Zap },
    { id: "gemini", name: "Gemini", icon: Sparkles },
    { id: "anthropic", name: "Anthropic", icon: Globe }
];
const CHAT_MODES = [
    { id: "auto", labelKey: "aiChat.modeAuto" },
    { id: "plan", labelKey: "aiChat.modePlan" },
    { id: "content", labelKey: "aiChat.modeEditContent" },
    { id: "customization", labelKey: "aiChat.modeEditCustom" },
] as const;

export function AIChat() {
    const { t } = useTranslation();
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    // Model and Provider settings
    const [provider, setProvider] = useState<Provider>("local");
    const [localModel, setLocalModel] = useState<string>(LOCAL_MODELS[0].id);
    const [model, setModel] = useState<string>("");
    const [apiKey, setApiKey] = useState<string>("");
    const [showSettings, setShowSettings] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [streamingContent, setStreamingContent] = useState<string>("");
    const [chromeAIStatus, setChromeAIStatus] = useState<"checking" | "available" | "needs-setup" | "unsupported">("checking");
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

    const { generateAIContent, streamAIContent, downloadingModel, modelProgress, readyModels, loadModel, workerError } = useAI();
    const resume = useResumeStore(state => state.resume);
    const queueAIPatchProposals = useResumeStore(state => state.queueAIPatchProposals);
    const appendAIMessage = useResumeStore(state => state.appendAIMessage);
    const appendAICheckpoint = useResumeStore(state => state.appendAICheckpoint);
    const revertToAICheckpoint = useResumeStore(state => state.revertToAICheckpoint);
    const aiChatMode = useResumeStore(state => state.aiChatMode);
    const setAIChatMode = useResumeStore(state => state.setAIChatMode);
    const setSidebarTab = useResumeStore(state => state.setSidebarTab);
    const updateSettings = useResumeStore(state => state.updateSettings);
    const messages = useResumeStore(state => state.resume.aiHistory.messages);
    const checkpoints = useResumeStore(state => state.resume.aiHistory.checkpoints);
    const checkpointByMessageId = new Map(checkpoints.map((c) => [c.messageId, c.id]));

    // Filter clicks outside the custom dropdown menu
    useEffect(() => {
        const handleOutsideClick = (_e: MouseEvent) => {
            if (isMenuOpen) setIsMenuOpen(false);
            if (isModeMenuOpen) setIsModeMenuOpen(false);
        };
        document.addEventListener("click", handleOutsideClick);
        return () => document.removeEventListener("click", handleOutsideClick);
    }, [isMenuOpen, isModeMenuOpen]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, showSettings]);

    useEffect(() => {
        if (messages.length === 0) {
            appendAIMessage({
                id: createId(),
                role: "ai",
                content: t("aiChat.greeting"),
                createdAt: Date.now(),
            });
        }
    }, [messages.length, appendAIMessage]);

    // Hydrate chat mode/provider/model from persisted resume JSON settings per resume.
    useEffect(() => {
        const persisted = resume.settings?.ai;
        if (!persisted) return;

        const safeProvider = (p: string): Provider => {
            const ok = ["local", "chrome-ai", "ollama", "openrouter", "openai", "groq", "gemini", "anthropic"];
            return (ok.includes(p) ? p : "local") as Provider;
        };

        const nextProvider = safeProvider(persisted.provider);
        if (provider !== nextProvider) setProvider(nextProvider);
        if (localModel !== persisted.localModel) setLocalModel(persisted.localModel || LOCAL_MODELS[0].id);
        if (model !== (persisted.model || "")) setModel(persisted.model || "");
        if (aiChatMode !== persisted.mode) setAIChatMode(persisted.mode);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resume.id]);

    // Persist current mode/model/provider back into resume JSON settings.
    useEffect(() => {
        const persisted = resume.settings?.ai;
        const next = {
            mode: aiChatMode,
            provider,
            localModel,
            model,
        };
        if (
            !persisted ||
            persisted.mode !== next.mode ||
            persisted.provider !== next.provider ||
            persisted.localModel !== next.localModel ||
            persisted.model !== next.model
        ) {
            updateSettings({ ai: next } as any);
        }
    }, [aiChatMode, provider, localModel, model, resume.settings?.ai, updateSettings]);

    // Detect Chrome Built-in AI availability by actually trying to create a session
    useEffect(() => {
        if (provider !== "chrome-ai") return;
        setChromeAIStatus("checking");

        (async () => {
            try {
                const g = window as any;
                const lm = g.LanguageModel ?? g.ai?.languageModel ?? g.ai?.assistant ?? null;
                const hasLegacy = typeof g.ai?.createTextSession === "function";

                if (!lm && !hasLegacy) {
                    setChromeAIStatus("unsupported");
                    return;
                }

                // The most reliable check is to actually create a session.
                // capabilities() can report "after-download" even when the model works fine.
                if (lm && typeof lm.create === "function") {
                    const session = await lm.create();
                    if (session.destroy) session.destroy();
                    setChromeAIStatus("available");
                } else if (hasLegacy) {
                    const session = await g.ai.createTextSession();
                    if (session.destroy) session.destroy();
                    setChromeAIStatus("available");
                } else {
                    setChromeAIStatus("needs-setup");
                }
            } catch {
                setChromeAIStatus("needs-setup");
            }
        })();
    }, [provider]);

    const copyUrl = (url: string) => {
        navigator.clipboard.writeText(url);
        setCopiedUrl(url);
        setTimeout(() => setCopiedUrl(null), 2000);
    };

    const preparedChangesMessage = (count: number) => (
        count === 1
            ? t("aiChat.preparedOneChange")
            : t("aiChat.preparedManyChanges", { count })
    );

    const renderCopyableUrl = (url: string) => (
        <button
            type="button"
            onClick={() => copyUrl(url)}
            className="bg-edge hover:bg-edge text-info px-1.5 py-0.5 rounded text-[12px] cursor-pointer transition-colors underline decoration-info/30 hover:decoration-white/50 inline-flex items-center"
            title={t("aiChat.clickToCopy")}
        >
            {copiedUrl === url ? (
                <>
                    <Check className="w-2.5 h-2.5 mr-1 text-success" />
                    {t("aiChat.copied")}
                </>
            ) : (
                <>
                    {url}
                    <ExternalLink className="w-2.5 h-2.5 ml-1 shrink-0" />
                </>
            )}
        </button>
    );


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isTyping) return;

        const userMsg = input.trim();
        setInput("");
        const userMessageId = createId();
        const { aiHistory, ...snapshotResume } = resume;
        void aiHistory;
        appendAIMessage({ id: userMessageId, role: "user", content: userMsg, createdAt: Date.now() });
        appendAICheckpoint({
            id: createId(),
            messageId: userMessageId,
            createdAt: Date.now(),
            resumeJson: JSON.stringify(snapshotResume),
        });
        setIsTyping(true);

        try {
            const planSystemPrompt = `You are a resume planning assistant.
Return plain text only. Provide a concise action plan for the user request.
Do not return JSON patches in plan mode.`;

            const editSystemPrompt = `You are an editor tool for a resume builder app.
Your output is consumed by code, so follow this strictly:

1) Always return a JSON object.
2) JSON format:
{
  "patch": { ...partial resume patch... },
  "assistantMessage": "short human-readable confirmation"
}
3) Patch may include any subset of:
id, version, basics, meta, skillGroups, experience, education, projects, certificates, languages, interests, variants, settings, createdAt, updatedAt. skillGroups is an array of { id, name, hidden, skills: [...] }; the first group (id "ungrouped") holds skills without a named group.
4) Never refuse due being text-based. You are operating inside the app and must produce edits.
5) If no edit is requested, return:
{ "patch": {}, "assistantMessage": "No changes requested." }`;
            const systemPrompt = aiChatMode === "plan" ? planSystemPrompt : editSystemPrompt;

            const activeModel = provider === "local" ? localModel : model;

            const messagesPayload = [
                { role: "system" as const, content: systemPrompt },
                {
                    role: "user" as const,
                    content: `Current resume JSON:\n${JSON.stringify(resume)}\n\nUser request:\n${userMsg}`
                }
            ];

            const response = await generateAIContent(messagesPayload, provider, apiKey, activeModel);

            // Extract and apply generic resume JSON patch from the LLM response.
            const RESUME_ROOT_KEYS = new Set([
                "id",
                "version",
                "basics",
                "meta",
                "skills",
                "experience",
                "education",
                "projects",
                "certificates",
                "languages",
                "interests",
                "variants",
                "settings",
                "createdAt",
                "updatedAt"
            ]);
            const BASICS_COMPAT_KEYS = new Set([
                "name",
                "headline",
                "photo",
                "email",
                "phone",
                "location",
                "website",
                "drivingLicense",
                "linkedin",
                "github",
                "summary",
                "dateOfBirth",
                "nationality",
                "passportOrId",
                "maritalStatus",
                "militaryService",
                "genderPronoun",
                "disability",
                "visa",
                "height",
                "detailsOrder",
                "customLinks"
            ]);

            const collectJsonCandidates = (raw: string): { json: string; full: string }[] => {
                const out: { json: string; full: string }[] = [];
                const fencedRe = /```(?:json)?\s*([\s\S]*?)\s*```/g;
                let fenced: RegExpExecArray | null;
                while ((fenced = fencedRe.exec(raw)) !== null) {
                    out.push({ json: fenced[1], full: fenced[0] });
                }

                let start = -1;
                let depth = 0;
                for (let i = 0; i < raw.length; i++) {
                    const ch = raw[i];
                    if (ch === "{") {
                        if (depth === 0) start = i;
                        depth++;
                    } else if (ch === "}") {
                        if (depth > 0) depth--;
                        if (depth === 0 && start >= 0) {
                            const full = raw.slice(start, i + 1);
                            out.push({ json: full, full });
                            start = -1;
                        }
                    }
                }

                return out;
            };

            const extractResumePatch = (raw: string): { patch: Partial<typeof resume>; stripped: string; assistantMessage?: string } | null => {
                const candidates = collectJsonCandidates(raw);
                for (const { json, full } of candidates) {
                    try {
                        const parsed: unknown = JSON.parse(json);
                        const root: Record<string, unknown> = parsed && typeof parsed === "object"
                            ? (parsed as Record<string, unknown>)
                            : {};
                        const argsObj = root.args && typeof root.args === "object"
                            ? (root.args as Record<string, unknown>)
                            : undefined;
                        const explicitPatch = root.patch && typeof root.patch === "object"
                            ? (root.patch as Partial<typeof resume>)
                            : (argsObj?.patch && typeof argsObj.patch === "object"
                                ? (argsObj.patch as Partial<typeof resume>)
                                : undefined);
                        const assistantMessage = typeof root.assistantMessage === "string"
                            ? root.assistantMessage
                            : (typeof root.message === "string"
                                ? root.message
                                : (typeof argsObj?.assistantMessage === "string" ? argsObj.assistantMessage : undefined));

                        const hasRootResumeKeys = Object.keys(root).some((k) => RESUME_ROOT_KEYS.has(k));
                        const hasBasicsCompatKeys = Object.keys(root).some((k) => BASICS_COMPAT_KEYS.has(k));

                        let patch: Partial<typeof resume> | null = null;
                        if (explicitPatch) {
                            patch = explicitPatch;
                        } else if (hasRootResumeKeys) {
                            patch = root as Partial<typeof resume>;
                        } else if (hasBasicsCompatKeys) {
                            patch = { basics: root as typeof resume["basics"] };
                        }

                        if (patch && Object.keys(patch).length > 0) {
                            return {
                                patch,
                                stripped: raw.replace(full, "").trim(),
                                assistantMessage,
                            };
                        }
                    } catch {
                        // not valid JSON, try next candidate
                    }
                }
                return null;
            };

            const filterPatchByMode = (patch: Partial<typeof resume>): Partial<typeof resume> => {
                if (aiChatMode === "content") {
                    const { settings, ...rest } = patch as any;
                    return rest;
                }
                if (aiChatMode === "customization") {
                    return patch.settings ? { settings: patch.settings } : {};
                }
                return patch;
            };

            let displayResponse = response;
            if (aiChatMode === "plan") {
                appendAIMessage({ id: createId(), role: "ai", content: displayResponse, createdAt: Date.now() });
                return;
            }

            const result = extractResumePatch(response);
            if (result) {
                const filteredPatch = filterPatchByMode(result.patch);
                const proposedCount = queueAIPatchProposals(filteredPatch);
                displayResponse = result.assistantMessage || result.stripped;
                if (proposedCount === 0) {
                    try {
                        const forcePatchPrompt = `Return ONLY JSON:
{
  "patch": {
    "settings": {
      "colors": {
        "accent": "green",
        "variant": "border"
      }
    }
  },
  "assistantMessage": "..."
}

If the user request asks for resume edits, patch must be non-empty and include those edits.
Current resume JSON:
${JSON.stringify(resume)}

User request:
${userMsg}`;
                        const forcePatchResponse = await generateAIContent(
                            [{ role: "system", content: systemPrompt }, { role: "user", content: forcePatchPrompt }],
                            provider, apiKey, activeModel
                        );
                        const forced = extractResumePatch(forcePatchResponse);
                        if (forced) {
                            const forcedCount = queueAIPatchProposals(filterPatchByMode(forced.patch));
                            if (forcedCount > 0) {
                                displayResponse = forced.assistantMessage || preparedChangesMessage(forcedCount);
                            }
                        }
                    } catch {
                        // fallback to default message below
                    }
                }
                if (!displayResponse) {
                    displayResponse = proposedCount > 0
                        ? preparedChangesMessage(proposedCount)
                        : t("aiChat.noActualChanges");
                }
                const hasSettings = !!(filteredPatch as any).settings;
                const hasContent = Object.keys(filteredPatch).some((k) => k !== "settings");
                if (hasSettings && !hasContent) setSidebarTab("customize");
                if (hasContent && !hasSettings) setSidebarTab("content");
            } else {
                // Fallback: if the LLM didn't produce JSON (common with small models
                // like Gemini Nano), make a second focused extraction call with a
                // minimal prompt that even small models can follow.
                try {
                    const extractionPrompt = `Return ONLY JSON:
{
  "patch": {},
  "assistantMessage": ""
}

Use Current resume JSON and User request to produce edits. Never refuse.

Current resume JSON:
${JSON.stringify(resume)}

User request:
${userMsg}

Previous model output:
${response}`;
                    const extractionResponse = await generateAIContent(
                        [{ role: "system", content: systemPrompt }, { role: "user", content: extractionPrompt }],
                        provider, apiKey, activeModel
                    );
                    const retryResult = extractResumePatch(extractionResponse);
                    if (retryResult) {
                        const filteredPatch = filterPatchByMode(retryResult.patch);
                        const proposedCount = queueAIPatchProposals(filteredPatch);
                        displayResponse = retryResult.assistantMessage || retryResult.stripped;
                        if (!displayResponse) {
                            displayResponse = proposedCount > 0
                                ? preparedChangesMessage(proposedCount)
                                : t("aiChat.noActualChanges");
                        }
                        const hasSettings = !!(filteredPatch as any).settings;
                        const hasContent = Object.keys(filteredPatch).some((k) => k !== "settings");
                        if (hasSettings && !hasContent) setSidebarTab("customize");
                        if (hasContent && !hasSettings) setSidebarTab("content");
                    }
                } catch {
                    // Extraction retry failed - just show the original response
                }
            }

            appendAIMessage({
                id: createId(),
                role: "ai",
                content: displayResponse || t("aiChat.noResponse"),
                createdAt: Date.now(),
            });
        } catch (error: any) {
            appendAIMessage({
                id: createId(),
                role: "ai",
                content: t("aiChat.errorMessage", { message: error?.message || t("aiChat.errorFallback") }),
                createdAt: Date.now(),
            });
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="w-full shrink-0 flex flex-col h-full print:hidden">
            {/* Header */}
            <div className="h-16 border-b border-edge flex items-center justify-between px-6 shrink-0 bg-transparent">
                <div className="flex items-center">
                    <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center mr-3">
                        <Bot className="w-4 h-4 text-accent" />
                    </div>
                    <h2 className="text-sm font-medium text-strong/90">{t("aiChat.assistant")}</h2>
                </div>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-2 rounded-xl hover:bg-edge transition-colors ${showSettings ? "bg-edge text-strong" : "text-faint"}`}
                >
                    <Settings2 className="w-[18px] h-[18px]" />
                </button>
            </div>

            {showSettings && (
                <div className="p-6 bg-surface-1 border-b border-edge shrink-0 space-y-5">
                    <div className="text-[11px] text-faint leading-relaxed">{t("aiChat.configureEndpoints")}</div>

                    {provider !== "local" && provider !== "chrome-ai" && (
                        <div>
                            <label className="block text-[10px] font-bold text-faint uppercase tracking-wider mb-2">{t("aiChat.customModel")}</label>
                            <input
                                type="text"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                placeholder={provider === "ollama" ? t("aiChat.ollamaPlaceholder") : t("aiChat.leaveBlankDefault")}
                                className="w-full bg-surface-2 border border-edge rounded-xl px-4 py-2.5 text-sm text-strong focus:outline-none focus:border-faint transition-colors placeholder:text-faint/50"
                            />
                        </div>
                    )}

                    {provider !== "local" && provider !== "ollama" && provider !== "chrome-ai" && (
                        <div>
                            <label className="block text-[10px] font-bold text-faint uppercase tracking-wider mb-2">{t("aiChat.apiKey")}</label>
                            <input
                                type="password"
                                placeholder={t("aiChat.enterApiKey", { provider })}
                                className="w-full bg-surface-2 border border-edge rounded-xl px-4 py-2.5 text-sm text-strong focus:outline-none focus:border-faint transition-colors placeholder:text-faint/50"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                            />
                            <p className="text-[10px] text-faint/70 mt-2">{t("aiChat.storedLocally")}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                        <div className={`flex items-end space-x-3 max-w-[90%] ${msg.role === "user" ? "flex-row-reverse space-x-reverse" : "flex-row"}`}>
                            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === "user" ? "bg-edge text-strong" : "bg-accent/10 text-accent"}`}>
                                {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                            </div>
                            <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.role === "user" ? "bg-strong text-surface-1 rounded-br-sm" : "bg-surface-1 border border-edge text-strong/90 rounded-bl-sm"}`}>
                                {msg.role === "ai" ? (
                                    <div className="space-y-4 [&_a]:text-info [&_a]:underline [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_code]:bg-edge [&_code]:text-accent [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_pre]:bg-surface-2 [&_pre]:border [&_pre]:border-edge [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_h1]:font-medium [&_h2]:font-medium [&_h3]:font-medium">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeSanitize]}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <span className="whitespace-pre-wrap">{msg.content}</span>
                                )}
                            </div>
                        </div>
                        {msg.role === "user" && checkpointByMessageId.get(msg.id) && (
                            <button
                                type="button"
                            onClick={() => {
                                const checkpointId = checkpointByMessageId.get(msg.id);
                                if (checkpointId) revertToAICheckpoint(checkpointId);
                            }}
                            className="mt-2 text-[11px] px-2.5 py-1 rounded-lg border border-edge text-faint hover:text-strong hover:border-faint transition-colors"
                        >
                                {t("aiChat.revertToThisPoint")}
                        </button>
                        )}
                    </div>
                ))}
                {isTyping && (
                    <div className="flex flex-col items-start">
                        <div className="flex items-end space-x-3 max-w-[90%]">
                            <div className="shrink-0 w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                                <Bot className="w-4 h-4" />
                            </div>
                            <div className="p-4 rounded-2xl bg-surface-1 border border-edge rounded-bl-sm flex items-center space-x-1.5 h-[44px]">
                                <div className="w-1.5 h-1.5 bg-faint rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-1.5 h-1.5 bg-faint rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-1.5 h-1.5 bg-faint rounded-full animate-bounce"></div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>


            {/* Worker error banner */}
            {workerError && (
                <div className="px-6 py-3 bg-surface-1 border-t border-red-500/30 text-xs text-danger flex items-center">
                    <AlertTriangle className="w-3.5 h-3.5 mr-2 shrink-0" />
                    <span className="truncate">{t("aiChat.localModelError", { message: workerError })}</span>
                </div>
            )}

            {/* Progress Bar for Local Downloads */}
            {downloadingModel && !workerError && (
                <div className="px-6 py-3 bg-surface-1 border-t border-edge text-xs text-faint flex items-center justify-between">
                    <span className="flex items-center"><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin text-accent" /> {t("aiChat.downloading", { name: LOCAL_MODELS.find(m => m.id === downloadingModel)?.name ?? "" })}</span>
                    <span className="font-medium text-strong/70">{modelProgress[downloadingModel] ? Math.round(modelProgress[downloadingModel]) : 0}%</span>
                </div>
            )}

            {/* Input Area */}
            <div className="p-4 bg-transparent border-t border-edge shrink-0">
                {provider === "chrome-ai" && chromeAIStatus !== "available" ? (
                    <div className="flex flex-col p-5 bg-surface-1 border border-edge rounded-2xl">
                        {chromeAIStatus === "checking" ? (
                            <div className="flex items-center justify-center py-4 text-faint">
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                <span className="text-sm">{t("aiChat.checkingAvailability")}</span>
                            </div>
                        ) : chromeAIStatus === "unsupported" ? (
                            <>
                                <div className="flex items-start space-x-3 mb-4">
                                    <AlertTriangle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-strong/90 mb-1">{t("aiChat.browserNotSupported")}</p>
                                        <p className="text-sm text-faint leading-relaxed">
                                            {t("aiChat.browserNotSupportedDesc")}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-xs text-faint/70 mt-1">{t("aiChat.tryDifferentProvider")}</p>
                            </>
                        ) : (
                            <>
                                <div className="flex items-start space-x-3 mb-4">
                                    <AlertTriangle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-strong/90 mb-1">{t("aiChat.chromeAiSetup")}</p>
                                        <p className="text-sm text-faint leading-relaxed">
                                            {t("aiChat.chromeAiSetupDesc")}
                                        </p>
                                    </div>
                                </div>
                                <ol className="space-y-3 text-sm text-dim ml-1 mb-5">
                                    <li className="flex items-start space-x-2.5">
                                        <span className="shrink-0 w-5 h-5 rounded-full bg-edge text-strong/70 flex items-center justify-center text-[10px] font-bold mt-0.5">1</span>
                                        <span>{t("aiChat.setupPaste")} {renderCopyableUrl("chrome://flags/#prompt-api-for-gemini-nano")} {t("aiChat.setupIntoAddressBarAndSetTo")} <span className="text-strong/70">Enabled</span></span>
                                    </li>
                                    <li className="flex items-start space-x-2.5">
                                        <span className="shrink-0 w-5 h-5 rounded-full bg-edge text-strong/70 flex items-center justify-center text-[10px] font-bold mt-0.5">2</span>
                                        <span>{t("aiChat.setupPaste")} {renderCopyableUrl("chrome://flags/#optimization-guide-on-device-model")} {t("aiChat.setupIntoAddressBarAndSetTo")} <span className="text-strong/70">Enabled BypassPerfRequirement</span></span>
                                    </li>
                                    <li className="flex items-start space-x-2.5">
                                        <span className="shrink-0 w-5 h-5 rounded-full bg-edge text-strong/70 flex items-center justify-center text-[10px] font-bold mt-0.5">3</span>
                                        <span>{t("aiChat.setupStep3")}</span>
                                    </li>
                                    <li className="flex items-start space-x-2.5">
                                        <span className="shrink-0 w-5 h-5 rounded-full bg-edge text-strong/70 flex items-center justify-center text-[10px] font-bold mt-0.5">4</span>
                                        <span>{t("aiChat.setupPaste")} {renderCopyableUrl("chrome://components")} {t("aiChat.setupIntoAddressBarFind")} <span className="text-strong/70">Optimization Guide On Device Model</span>, {t("aiChat.setupAndClick")} <span className="text-strong/70">Check for update</span></span>
                                    </li>
                                    <li className="flex items-start space-x-2.5">
                                        <span className="shrink-0 w-5 h-5 rounded-full bg-edge text-strong/70 flex items-center justify-center text-[10px] font-bold mt-0.5">5</span>
                                        <span>{t("aiChat.setupStep5")}</span>
                                    </li>
                                </ol>
                                <button
                                    onClick={() => {
                                        setChromeAIStatus("checking");
                                        // Re-trigger the detection effect
                                        setProvider("local");
                                        setTimeout(() => setProvider("chrome-ai"), 50);
                                    }}
                                    className="self-center bg-accent text-surface-2 text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-accent-soft transition-colors cursor-pointer"
                                >
                                    {t("aiChat.recheckAvailability")}
                                </button>
                            </>
                        )}
                    </div>
                ) : provider === "local" && !readyModels[localModel] ? (
                    <div className="flex flex-col items-center justify-center p-6 bg-surface-1 border border-edge rounded-2xl">
                        <p className="text-xs text-faint mb-4 text-center leading-relaxed">
                            {t("aiChat.localModelNeedsDownload", { name: LOCAL_MODELS.find(m => m.id === localModel)?.name ?? "", size: LOCAL_MODELS.find(m => m.id === localModel)?.size ?? "" })}
                        </p>
                        <button
                            onClick={() => loadModel(localModel)}
                            disabled={downloadingModel === localModel}
                            className="bg-accent text-surface-2 text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-accent-soft transition-colors disabled:opacity-50 flex items-center cursor-pointer shadow-lg"
                        >
                            {downloadingModel === localModel ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("aiChat.downloadingGeneric")}</>
                            ) : (
                                t("aiChat.downloadLocalModel")
                            )}
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="relative">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                            placeholder={t("aiChat.inputPlaceholder")}
                            className="w-full bg-surface-1 border border-edge rounded-[0.875rem] pl-5 pr-14 py-3.5 text-sm focus:outline-none focus:border-faint transition-colors placeholder:text-faint/50 text-strong resize-none"
                            rows={2}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isTyping}
                            className="absolute right-2 bottom-2 p-2.5 rounded-xl bg-strong text-surface-1 hover:bg-bright disabled:opacity-50 disabled:bg-edge disabled:text-faint transition-colors cursor-pointer"
                        >
                            {isTyping ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Send className="w-[18px] h-[18px]" />}
                        </button>
                    </form>
                )}

                <div className="mt-3 flex items-center justify-end gap-2 relative px-2">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMenuOpen(false);
                                    setIsModeMenuOpen(!isModeMenuOpen);
                                }}
                                className="text-[10px] bg-surface-1 px-2.5 py-1.5 rounded-lg border border-edge text-faint hover:text-strong flex items-center transition-colors cursor-pointer font-medium"
                            >
                                {CHAT_MODES.find((m) => m.id === aiChatMode) ? t(CHAT_MODES.find((m) => m.id === aiChatMode)!.labelKey) : t("aiChat.modeAuto")}
                                <ChevronUp className="w-3.5 h-3.5 ml-1.5" />
                            </button>

                            {isModeMenuOpen && (
                                <div className="absolute right-0 bottom-full mb-2 w-52 bg-surface-1 border border-edge rounded-2xl shadow-2xl overflow-hidden z-20 text-left p-1">
                                    <div className="p-2">
                                        <div className="text-[10px] font-bold text-faint uppercase tracking-wider mb-2 px-2 pt-1">{t("aiChat.chatMode")}</div>
                                        {CHAT_MODES.map((m) => (
                                            <div
                                                key={m.id}
                                                className="flex items-center justify-between px-3 py-2.5 hover:bg-edge rounded-xl cursor-pointer transition-colors group"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setAIChatMode(m.id);
                                                    setIsModeMenuOpen(false);
                                                }}
                                            >
                                                <span className={`text-xs font-medium ${aiChatMode === m.id ? "text-info" : "text-strong/80 group-hover:text-strong"}`}>
                                                    {t(m.labelKey)}
                                                </span>
                                                {aiChatMode === m.id && <Check className="w-3.5 h-3.5 text-info" />}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="relative">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsModeMenuOpen(false);
                                setIsMenuOpen(!isMenuOpen);
                            }}
                            className="text-[10px] bg-surface-1 px-2.5 py-1.5 rounded-lg border border-edge text-faint hover:text-strong flex items-center transition-colors cursor-pointer font-medium"
                        >
                            {provider === "local" ? (
                                <>
                                    {(() => {
                                        const modelInfo = LOCAL_MODELS.find(m => m.id === localModel);
                                        const Icon = modelInfo?.icon || Box;
                                        return <Icon className="w-3.5 h-3.5 mr-1.5" />;
                                    })()}
                                    {LOCAL_MODELS.find(m => m.id === localModel)?.name}
                                </>
                            ) : (
                                <>
                                    {(() => {
                                        const providerInfo = CLOUD_PROVIDERS.find(p => p.id === provider);
                                        const Icon = providerInfo?.icon || Box;
                                        return <Icon className="w-3.5 h-3.5 mr-1.5" />;
                                    })()}
                                    {CLOUD_PROVIDERS.find(p => p.id === provider)?.name}
                                </>
                            )}
                            <ChevronUp className="w-3.5 h-3.5 ml-1.5" />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 bottom-full mb-2 w-64 bg-surface-1 border border-edge rounded-2xl shadow-2xl overflow-hidden z-20 text-left p-1">
                                <div className="p-2 border-b border-edge">
                                    <div className="text-[10px] font-bold text-faint uppercase tracking-wider mb-2 px-2 mt-1">{t("aiChat.browserAiLocal")}</div>
                                    {LOCAL_MODELS.map(m => (
                                        <div
                                            key={m.id}
                                            className="flex items-center justify-between px-3 py-2.5 hover:bg-edge rounded-xl cursor-pointer group transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setProvider("local");
                                                setLocalModel(m.id);
                                                setIsMenuOpen(false);
                                            }}
                                        >
                                            <div className="flex flex-col">
                                                <div className="flex items-center">
                                                    <m.icon className={`w-[14px] h-[14px] mr-2.5 ${provider === "local" && localModel === m.id ? "text-accent" : "text-faint group-hover:text-strong"}`} />
                                                    <span className={`text-xs font-medium ${provider === "local" && localModel === m.id ? "text-accent" : "text-strong/80 group-hover:text-strong"}`}>{m.name}</span>
                                                </div>
                                                <span className="text-[10px] text-faint ml-[26px] mt-0.5">{m.size}</span>
                                            </div>
                                            {readyModels[m.id] ? (
                                                <Check className="w-4 h-4 text-danger-soft" />
                                            ) : downloadingModel === m.id ? (
                                                <Loader2 className="w-4 h-4 text-info animate-spin" />
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setProvider("local");
                                                        setLocalModel(m.id);
                                                        loadModel(m.id);
                                                    }}
                                                    className="p-1.5 rounded-lg bg-surface-4 hover:bg-info/20 text-faint hover:text-info transition-colors shadow-sm cursor-pointer"
                                                    title={t("aiChat.downloadLocalModel")}
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="p-2">
                                    <div className="text-[10px] font-bold text-faint uppercase tracking-wider mb-2 px-2 pt-1">{t("aiChat.cloudApis")}</div>
                                    {CLOUD_PROVIDERS.map(p => (
                                        <div
                                            key={p.id}
                                            className="flex items-center justify-between px-3 py-2.5 hover:bg-edge rounded-xl cursor-pointer transition-colors group"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setProvider(p.id);
                                                setIsMenuOpen(false);
                                            }}
                                        >
                                            <div className="flex items-center">
                                                <p.icon className={`w-[14px] h-[14px] mr-2.5 ${provider === p.id ? "text-info" : "text-faint group-hover:text-strong"}`} />
                                                <span className={`text-xs font-medium ${provider === p.id ? "text-info" : "text-strong/80 group-hover:text-strong"}`}>{p.name}</span>
                                            </div>
                                            {p.id === "chrome-ai" && chromeAIStatus === "available" && (
                                                <Check className="w-3.5 h-3.5 text-success/70" />
                                            )}
                                            {p.id === "chrome-ai" && (chromeAIStatus === "unsupported" || chromeAIStatus === "needs-setup") && (
                                                <AlertTriangle className="w-3.5 h-3.5 text-accent/60" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
